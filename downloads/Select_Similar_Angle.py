# -*- coding: utf-8 -*-
"""Cinema 4D Script Manager: selection similaire par normales geometriques.

Utilisation : objet polygonal editable, mode Polygones, selectionner une
ou plusieurs faces, puis executer. Memoriser les faces, regler la tolerance, puis Appliquer.
Fenetre flottante non bloquante ; Restaurer retrouve la selection memorisee.
Apres une modification de topologie, memoriser de nouveau les references.
Les faces sont comparees a CHAQUE face initialement selectionnee (pas de
propagation). Les faces cachees sont ignorees. Ctrl+Z annule la selection.
Calcul dans l'espace local de l'objet, sans normales Phong ni deformations.
Les n-gones sont traites via leurs triangles/quadrangles internes C4D.
Concu pour le Python 3 de Cinema 4D ; teste localement par l'auteur dans Cinema 4D 2026.
"""

import math
import c4d
from c4d import gui

DEFAULT_ANGLE = 5.0
IGNORE_OPPOSITE_NORMALS = False  # True: faces paralleles inverses acceptees.


def face_normal(points, polygon):
    """Normale normalisee (somme des deux triangles pour un quadrangle)."""
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
                           name="1. Selectionne les faces de reference dans la vue.")
        self.AddButton(self.CAPTURE, c4d.BFH_SCALEFIT,
                       name="Memoriser la selection de reference")
        self.AddStaticText(2002, c4d.BFH_LEFT,
                           name="2. Tolerance en degres (0 a 180)")
        self.AddEditSlider(self.ANGLE, c4d.BFH_SCALEFIT)
        self.AddCheckbox(self.OPPOSITE, c4d.BFH_LEFT, 0, 0,
                         "Inclure les normales opposees")
        self.AddButton(self.APPLY, c4d.BFH_SCALEFIT, name="Appliquer la selection")
        self.AddButton(self.RESTORE, c4d.BFH_SCALEFIT,
                       name="Restaurer la selection de reference")
        self.AddStaticText(self.STATUS, c4d.BFH_SCALEFIT,
                           name="Aucune reference memorisee.")
        self.AddStaticText(2003, c4d.BFH_LEFT,
                           name="Ctrl+Z : annuler. Apres extrusion : memoriser a nouveau.")
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
            self.status("Choisis un objet polygonal editable.")
            return
        if doc.GetMode() != c4d.Mpolygons:
            self.status("Passe en mode Polygones.")
            return
        sel, hidden = obj.GetPolygonS(), obj.GetPolygonH()
        seeds = {i for i in range(obj.GetPolygonCount())
                 if sel.IsSelected(i) and not hidden.IsSelected(i)}
        if not seeds:
            self.status("Selectionne au moins une face visible.")
            return
        self.obj, self.source_doc, self.seeds = obj, doc, seeds
        self.topology = self.signature(obj)
        self.status("{} : {} reference(s).".format(obj.GetName(), len(seeds)))

    def validated_target(self):
        doc = c4d.documents.GetActiveDocument()
        try:
            if (self.obj is None or not self.obj.IsAlive()
                    or doc != self.source_doc or self.obj.GetDocument() != doc
                    or doc.GetActiveObject() != self.obj):
                self.status("Objet/document different : memorise les references.")
                return None
            if doc.GetMode() != c4d.Mpolygons:
                self.status("Passe en mode Polygones.")
                return None
            if self.signature(self.obj) != self.topology:
                self.status("Topologie modifiee : memorise les references.")
                return None
        except ReferenceError:
            self.status("Objet supprime : memorise les references.")
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
                self.status("Angle invalide : utilise 0 a 180 degres.")
                return
            if not visible_seeds:
                self.status("References masquees : memorise des faces visibles.")
                return
            points = obj.GetAllPoints()
            normals = [face_normal(points, p) for p in obj.GetAllPolygons()]
            refs = list(dict.fromkeys(normals[i] for i in visible_seeds
                                     if normals[i] is not None))
            if not refs:
                self.status("References de surface nulle : choisis d'autres faces.")
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
        self.status("{} face(s) visible(s) selectionnee(s).".format(
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
