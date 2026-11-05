# -*- coding: utf-8 -*-
"""Cinema 4D Script Manager: select similar geometric polygon normals.

Usage: select one or more faces on an editable polygon object in Polygon mode,
then run the script. Capture the reference faces, set the tolerance, and apply.
The non-modal floating window stays open; Restore retrieves the captured selection.
After changing topology, capture the references again.
Each face is compared with EVERY initially selected reference face (no propagation).
Hidden faces are ignored. Ctrl+Z undoes the selection.
Normals are calculated in object-local space, without Phong normals or deformations.
N-gons use Cinema 4D's internal triangles and quads.
Designed for Cinema 4D Python 3; tested locally by the author in Cinema 4D 2026.
"""

import math
import c4d
from c4d import gui

DEFAULT_ANGLE = 5.0
IGNORE_OPPOSITE_NORMALS = False  # True: accept parallel faces pointing in the opposite direction.


def face_normal(points, polygon):
    """Unit normal (sum of both triangles for a quad)."""
    a, b, c, d = (points[i] for i in
                  (polygon.a, polygon.b, polygon.c, polygon.d))
    ab = (b.x - a.x, b.y - a.y, b.z - a.z)
    ac = (c.x - a.x, c.y - a.y, c.z - a.z)
    ad = (d.x - a.x, d.y - a.y, d.z - a.z)
    n = (ab[1]*ac[2] - ab[2]*ac[1] + ac[1]*ad[2] - ac[2]*ad[1],
         ab[2]*ac[0] - ab[0]*ac[2] + ac[2]*ad[0] - ac[0]*ad[2],
         ab[0]*ac[1] - ab[1]*ac[0] + ac[0]*ad[1] - ac[1]*ad[0])
    length = math.sqrt(sum(v*v for v in n))
    return tuple(v / length for v in n) if length > 0.0 else None


def matches(normal, references, angle, ignore_opposite=False):
    if normal is None:
        return False
    threshold = math.cos(math.radians(angle))
    for reference in references:
        dot = sum(a*b for a, b in zip(normal, reference))
        if ignore_opposite:
            dot = abs(dot)
        if dot >= threshold - 1e-12:
            return True
    return False


class SimilarDialog(gui.GeDialog):
    ANGLE, OPPOSITE, CAPTURE, APPLY, RESTORE, STATUS = range(1001, 1007)

    def __init__(self):
        super().__init__()
        self.obj = None
        self.source_doc = None
        self.seeds = set()
        self.topology = None

    def CreateLayout(self):
        self.SetTitle("Select Similar - Angle")
        self.GroupBegin(2000, c4d.BFH_SCALEFIT, 1, 0)
        self.GroupBorderSpace(12, 12, 12, 12)
        self.AddStaticText(2001, c4d.BFH_LEFT,
                           name="1. Select reference faces in the viewport.")
        self.AddButton(self.CAPTURE, c4d.BFH_SCALEFIT,
                       name="Capture reference selection")
        self.AddStaticText(2002, c4d.BFH_LEFT,
                           name="2. Angle tolerance in degrees (0 to 180)")
        self.AddEditSlider(self.ANGLE, c4d.BFH_SCALEFIT)
        self.AddCheckbox(self.OPPOSITE, c4d.BFH_LEFT, 0, 0,
                         "Include opposite normals")
        self.AddButton(self.APPLY, c4d.BFH_SCALEFIT, name="Apply selection")
        self.AddButton(self.RESTORE, c4d.BFH_SCALEFIT,
                       name="Restore reference selection")
        self.AddStaticText(self.STATUS, c4d.BFH_SCALEFIT,
                           name="No reference selection captured.")
        self.AddStaticText(2003, c4d.BFH_LEFT,
                           name="Ctrl+Z: undo. After extruding: capture again.")
        self.GroupEnd()
        return True

    def InitValues(self):
        self.SetFloat(self.ANGLE, DEFAULT_ANGLE, min=0.0, max=180.0, step=0.1)
        self.SetBool(self.OPPOSITE, False)
        return True

    def status(self, text):
        self.SetString(self.STATUS, text)

    @staticmethod
    def signature(obj):
        return (obj.GetPointCount(), tuple((p.a, p.b, p.c, p.d)
                                          for p in obj.GetAllPolygons()))

    def capture(self):
        doc = c4d.documents.GetActiveDocument()
        obj = doc.GetActiveObject()
        if obj is None or not obj.CheckType(c4d.Opolygon):
            self.status("Choose an editable polygon object.")
            return
        if doc.GetMode() != c4d.Mpolygons:
            self.status("Switch to Polygon mode.")
            return
        sel, hidden = obj.GetPolygonS(), obj.GetPolygonH()
        seeds = {i for i in range(obj.GetPolygonCount())
                 if sel.IsSelected(i) and not hidden.IsSelected(i)}
        if not seeds:
            self.status("Select at least one visible face.")
            return
        self.obj, self.source_doc, self.seeds = obj, doc, seeds
        self.topology = self.signature(obj)
        self.status("{}: {} reference face(s).".format(obj.GetName(), len(seeds)))

    def validated_target(self):
        doc = c4d.documents.GetActiveDocument()
        try:
            if (self.obj is None or not self.obj.IsAlive()
                    or doc != self.source_doc or self.obj.GetDocument() != doc
                    or doc.GetActiveObject() != self.obj):
                self.status("Object/document changed: capture the references.")
                return None
            if doc.GetMode() != c4d.Mpolygons:
                self.status("Switch to Polygon mode.")
                return None
            if self.signature(self.obj) != self.topology:
                self.status("Topology changed: capture the references.")
                return None
        except ReferenceError:
            self.status("Object deleted: capture the references.")
            return None
        return doc, self.obj

    def apply_selection(self, restore=False):
        target = self.validated_target()
        if target is None:
            return
        doc, obj = target
        hidden, sel = obj.GetPolygonH(), obj.GetPolygonS()
        count = obj.GetPolygonCount()
        # Preserve the CURRENT selection state of hidden polygons.
        result = {i for i in range(count)
                  if hidden.IsSelected(i) and sel.IsSelected(i)}
        visible_seeds = {i for i in self.seeds if not hidden.IsSelected(i)}
        result.update(visible_seeds)
        if not restore:
            angle = self.GetFloat(self.ANGLE)
            if not math.isfinite(angle) or not 0 <= angle <= 180:
                self.status("Invalid angle: use 0 to 180 degrees.")
                return
            if not visible_seeds:
                self.status("References hidden: capture visible faces.")
                return
            points = obj.GetAllPoints()
            normals = [face_normal(points, p) for p in obj.GetAllPolygons()]
            refs = list(dict.fromkeys(normals[i] for i in visible_seeds
                                     if normals[i] is not None))
            if not refs:
                self.status("Zero-area references: choose other faces.")
                return
            result.update(i for i, n in enumerate(normals)
                          if not hidden.IsSelected(i)
                          and matches(n, refs, angle, self.GetBool(self.OPPOSITE)))
        current = {i for i in range(count) if sel.IsSelected(i)}
        if current != result:
            c4d.StopAllThreads()
            doc.StartUndo()
            try:
                doc.AddUndo(c4d.UNDOTYPE_CHANGE_SELECTION, obj)
                sel.DeselectAll()
                for i in result:
                    sel.Select(i)
                obj.Message(c4d.MSG_UPDATE)
            finally:
                doc.EndUndo()
            c4d.EventAdd()
        self.status("{} visible face(s) selected.".format(
            sum(not hidden.IsSelected(i) for i in result)))

    def Command(self, control_id, msg):
        if control_id == self.CAPTURE:
            self.capture()
        elif control_id == self.APPLY:
            self.apply_selection()
        elif control_id == self.RESTORE:
            self.apply_selection(restore=True)
        return True


# A global reference keeps the asynchronous window alive in Script Manager.
_dialog = None


def main():
    global _dialog
    if _dialog is None:
        _dialog = SimilarDialog()
    _dialog.Open(c4d.DLG_TYPE_ASYNC, defaultw=440, defaulth=280)


if __name__ == "__main__":
    main()
