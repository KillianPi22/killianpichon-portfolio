"""Clothes reconstructed on the native MetaHuman body, without scan geometry.

create_outfit(body, rig, output_dir) expects the original, unposed FBX body in
metres in Blender world space, +Z up and facing -Y. It preserves the supplied
body and returns garment meshes skinned to the supplied native rig. The caller
can then remove covered body faces. output_dir is reserved for future bakes.
"""
import math
import bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree


# Rest-pose lower-neck profile of the selected unscaled FaceMesh A. Samples
# follow the oblique crewneck plane z = 1.395 + .2 * (y - .01). They are only
# fitting dimensions; every sweater surface is new geometry on the native rig.
_NECK_PROFILE = (
    .061704, .061113, .060165, .059505, .059700, .060829, .062123, .063607,
    .065608, .067964, .070727, .075572, .083624, .090059, .089935, .085601,
    .079682, .073606, .068833, .064466, .060834, .058351, .056797, .055909,
    .055546, .055467, .055974, .056973, .058844, .061849, .065764, .070159,
    .075203, .080783, .085505, .087117, .083660, .077004, .072904, .070601,
    .068782, .067003, .065494, .064069, .062586, .061652, .061643, .061838,
)


def _neckline_point(angle, height=0):
    coordinate = ((angle + math.pi) % math.tau) / math.tau * len(_NECK_PROFILE)
    index = int(coordinate)
    t = coordinate - index
    radius = _NECK_PROFILE[index] * (1-t) + _NECK_PROFILE[(index+1) % 48] * t
    # Taper towards the neck above the seam. The bottom overlaps the hidden
    # native skin by 4 mm; the small clearance avoids shoulder breakthrough.
    radius += .004 - height * .5
    x, y = radius * math.sin(angle), .01 + radius * math.cos(angle)
    return Vector((x, y, 1.395 + .2 * (y - .01) + height))


def _crewneck(material, rig):
    vertices, faces = [], []
    for layer in range(5):
        height = -.007 + .014 * layer / 4
        for j in range(96):
            vertices.append(_neckline_point(-math.pi + j / 96 * math.tau, height))
    for layer in range(4):
        for j in range(96):
            k = (j+1) % 96
            faces.append((layer*96+j, (layer+1)*96+j, (layer+1)*96+k, layer*96+k))
    obj = _mesh('Sweatshirt_Crewneck', vertices, faces, material)
    _skin(obj, rig, bone='spine_05')
    return obj


def _material(name, color, roughness=.9):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = .22
    return mat


def _mesh(name, vertices, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(material)
    for face in data.polygons:
        face.use_smooth = True
    return obj


def _clone_surface(body, rig, name, material):
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = name
    bpy.context.scene.collection.objects.link(obj)
    obj.animation_data_clear()
    obj.modifiers.clear()
    arm = obj.modifiers.new('Native_MetaHuman_Skin', 'ARMATURE')
    arm.object = rig
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for p in obj.data.polygons:
        p.material_index = 0
    for attr in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attr)
    # The imported skin has duplicate UV-seam vertices; plain fabric needs a
    # continuous surface so smoothing does not open cracks at those seams.
    bm = bmesh.new(); bm.from_mesh(obj.data)
    distance = .00003 / max(abs(obj.matrix_world.to_scale().x), .00001)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=distance)
    bm.to_mesh(obj.data); bm.free()
    return obj


def _cut(obj, point, normal, outside=True):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    inverse = obj.matrix_world.inverted()
    bmesh.ops.bisect_plane(
        bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-6,
        plane_co=inverse @ Vector(point),
        plane_no=obj.matrix_world.to_3x3().transposed() @ Vector(normal),
        clear_outer=outside, clear_inner=not outside)
    bm.to_mesh(obj.data)
    bm.free()


def _delete_region(obj, predicate):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if predicate(obj.matrix_world @ v.co)], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


def _relax(obj, repetitions=10):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    vertices = [v for v in bm.verts if not v.is_boundary]
    for _ in range(repetitions):
        bmesh.ops.smooth_vert(bm, verts=vertices, factor=.4, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()


def _apply(obj, modifier):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def _finish_shell(obj):
    # Surface topology and native weights stay shared across sleeves and torso.
    reduction = obj.modifiers.new('Cloth_web_topology', 'DECIMATE')
    reduction.ratio = .58
    _apply(obj, reduction)
    shell = obj.modifiers.new('Cloth_edge_thickness', 'SOLIDIFY')
    shell.thickness = .0015 / max(abs(obj.matrix_world.to_scale().x), .00001)
    shell.offset = -1
    shell.use_rim = True
    _apply(obj, shell)
    for p in obj.data.polygons:
        p.use_smooth = True


def _bone_point(rig, name):
    return rig.matrix_world @ rig.data.bones[name].head_local


def _web_sleeve_weights(obj, rig):
    """Use a broad elbow blend with autonomous native arm bones for Web."""
    primary = {name for side in ('l', 'r')
               for name in ('upperarm_'+side, 'lowerarm_'+side, 'hand_'+side)}
    mapping = {}
    for group in obj.vertex_groups:
        name = group.name
        bone = rig.data.bones.get(name)
        if name.startswith(('upperarm_', 'lowerarm_', 'wrist_')):
            while bone and bone.name not in primary: bone = bone.parent
            if bone: name = bone.name
        mapping[group.index] = name
    targets = {}
    for side in ('l', 'r'):
        shoulder = _bone_point(rig, 'upperarm_'+side)
        elbow = _bone_point(rig, 'lowerarm_'+side)
        wrist = _bone_point(rig, 'hand_'+side)
        bisector = ((elbow-shoulder).normalized()+(wrist-elbow).normalized()).normalized()
        targets[side] = (elbow, bisector)
    weights = []
    for vertex in obj.data.vertices:
        merged = {}
        for group in vertex.groups:
            name = mapping[group.group]
            merged[name] = merged.get(name, 0) + group.weight
        p = obj.matrix_world @ vertex.co
        for side in ('l', 'r'):
            upper, lower = 'upperarm_'+side, 'lowerarm_'+side
            mass = merged.get(upper, 0) + merged.get(lower, 0)
            if mass < .001: continue
            elbow, bisector = targets[side]
            t = max(0, min(1, ((p-elbow).dot(bisector)+.085)/.17))
            lower_weight = t*t*(3-2*t)
            merged[upper] = mass*(1-lower_weight)
            merged[lower] = mass*lower_weight
        weights.append(merged)
    obj.vertex_groups.clear()
    groups = {}
    for vertex, merged in zip(obj.data.vertices, weights):
        for name, weight in merged.items():
            if weight <= .00001: continue
            if name not in groups: groups[name] = obj.vertex_groups.new(name=name)
            groups[name].add([vertex.index], weight, 'REPLACE')


def _smooth_elbow_cloth(obj, rig):
    """Give fabric a continuous sleeve section across the anatomical elbow."""
    world, inverse = obj.matrix_world.copy(), obj.matrix_world.inverted()
    paths = {}
    for side in ('l', 'r'):
        shoulder = _bone_point(rig, 'upperarm_'+side)
        elbow = _bone_point(rig, 'lowerarm_'+side)
        wrist = _bone_point(rig, 'hand_'+side)
        upper, lower = (elbow-shoulder).normalized(), (wrist-elbow).normalized()
        upper_length, lower_length = (elbow-shoulder).length, (wrist-elbow).length
        a, b = elbow-upper*.075, elbow+lower*.075
        samples = []
        for j in range(41):
            t = j/40
            samples.append((shoulder.lerp(a,t), upper, (upper_length-.075)*t))
        for j in range(1,61):
            t = j/60
            point = (1-t)**2*a+2*(1-t)*t*elbow+t*t*b
            tangent = ((elbow-a)*(1-t)+(b-elbow)*t).normalized()
            samples.append((point,tangent,upper_length-.075+.15*t))
        for j in range(1,41):
            t = j/40
            samples.append((b.lerp(wrist,t),lower,upper_length+.075+(lower_length-.075)*t))
        paths[side] = (samples,upper_length,upper_length+lower_length)
    for vertex in obj.data.vertices:
        p = world @ vertex.co
        if abs(p.x)<.225: continue
        side = 'l' if p.x>0 else 'r'
        samples,elbow_s,total = paths[side]
        center,tangent,s = min(samples,key=lambda item:(p-item[0]).length_squared)
        radial = p-center
        radial -= tangent*radial.dot(tangent)
        if radial.length<.015 or radial.length>.09: continue
        # The upper yoke and final 6 cm at the cuffs remain unchanged.
        blend = .9*math.exp(-((s-elbow_s)/.135)**4)
        blend *= max(0,min(1,(s-.09)/.065))*max(0,min(1,(total-s-.06)/.035))
        radius = .054 - .042*(s-elbow_s)
        target = center + radial.normalized()*radius
        vertex.co = inverse @ p.lerp(target,blend)


def _skin(obj, rig, nearest=None, bone=None):
    # Geometry supplied in world space, with identity transform.
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    arm = obj.modifiers.new('Native_MetaHuman_Skin', 'ARMATURE')
    arm.object = rig
    if bone:
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    else:
        kd, weights = nearest
        groups = {}
        for vertex in obj.data.vertices:
            _, index, _ = kd.find(vertex.co)
            influences = weights[index]
            for name, weight in influences:
                if name not in groups:
                    groups[name] = obj.vertex_groups.new(name=name)
                groups[name].add([vertex.index], weight, 'REPLACE')


def _ring(name, center, axis, radius, length, material, rig, nearest, oval=1):
    axis = Vector(axis).normalized()
    side = axis.cross(Vector((0, 1, 0)))
    if side.length < .01:
        side = axis.cross(Vector((1, 0, 0)))
    side.normalize()
    front = axis.cross(side).normalized()
    vertices, faces = [], []
    for layer in range(5):
        t = layer / 4
        bulge = .0015 * math.sin(t * math.pi)
        for j in range(48):
            a = j / 48 * math.tau
            p = Vector(center) + axis * ((t - .5) * length)
            p += side * ((radius + bulge) * math.cos(a)) + front * ((radius + bulge) * oval * math.sin(a))
            vertices.append(p)
    for layer in range(4):
        for j in range(48):
            n = (j + 1) % 48
            faces.append((layer * 48 + j, layer * 48 + n, (layer + 1) * 48 + n, (layer + 1) * 48 + j))
    obj = _mesh(name, vertices, faces, material)
    _skin(obj, rig, nearest)
    return obj


def _tube(name, points, radius, material, rig, nearest=None, bone=None):
    bpy.ops.object.select_all(action='DESELECT')
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, xyz in zip(spline.points, points):
        p.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.data.materials.append(material)
    _skin(obj, rig, nearest, bone)
    obj.select_set(False)
    return obj


def _upper_yoke(sweater, material, rig, nearest):
    """Cover the native face/body seam with a new garment shoulder panel."""
    bm = bmesh.new(); bm.from_mesh(sweater.data)
    edges = {e for e in bm.edges if e.is_boundary
             and all((sweater.matrix_world @ v.co).z > 1.2 for v in e.verts)}
    loops = []
    while edges:
        edge = edges.pop()
        start, current = edge.verts
        loop = [start, current]
        while current != start:
            adjacent = [edge for edge in current.link_edges if edge in edges]
            if not adjacent: break
            edge = adjacent[0]
            edges.remove(edge)
            current = edge.other_vert(current)
            loop.append(current)
        if current == start: loops.append(loop[:-1])
    if not loops:
        bm.free()
        raise ValueError('Cannot find the native body upper-chest boundary')
    loop = max(loops, key=len)
    outer = [sweater.matrix_world @ v.co for v in loop]
    bm.free()
    if len(outer) < 8:
        raise ValueError('Cannot find the native body upper-chest boundary')
    # Follow the actual boundary: the two shoulder concavities make sorting
    # vertices by polar angle connect the wrong edges and leave two tears.
    area = sum(a.x*b.y-b.x*a.y for a,b in zip(outer, outer[1:]+outer[:1]))
    if area > 0: outer.reverse()
    n = len(outer)
    angles = [math.atan2(p.x, p.y-.01) for p in outer]
    for j in range(1,n):
        while angles[j]-angles[j-1] < -math.pi: angles[j] += math.tau
        while angles[j]-angles[j-1] > math.pi: angles[j] -= math.tau
    # Smooth only the parameterization of the inner collar edge, retaining
    # every source boundary coordinate for a watertight welded connection.
    for _ in range(5):
        extended = [angles[-1]-math.tau] + angles + [angles[0]+math.tau]
        angles = [(extended[j]+2*extended[j+1]+extended[j+2])/4 for j in range(n)]
    vertices, faces = [], []
    for layer in range(8):
        t = layer / 7
        for p, angle in zip(outer, angles):
            inner = _neckline_point(angle)
            point = p.lerp(inner, t)
            point.z += .003 * math.sin(t * math.pi)
            vertices.append(point)
    for layer in range(7):
        for j in range(n):
            k = (j + 1) % n
            faces.append((layer*n+j, (layer+1)*n+j, (layer+1)*n+k, layer*n+k))
    yoke = _mesh('Native_Sweater_Shoulder_Yoke', vertices, faces, material)
    _skin(yoke, rig, nearest)
    spine = yoke.vertex_groups.get('spine_05') or yoke.vertex_groups.new(name='spine_05')
    for vertex in yoke.data.vertices:
        blend = (vertex.index // n / 7) ** 2
        if not blend: continue
        old = [(yoke.vertex_groups[g.group], g.weight) for g in vertex.groups]
        spine_weight = blend
        for group, weight in old:
            group.remove([vertex.index])
            if group == spine: spine_weight += weight * (1 - blend)
            else: group.add([vertex.index], weight * (1 - blend), 'REPLACE')
        spine.add([vertex.index], spine_weight, 'REPLACE')
    return yoke


def create_outfit(body, rig, output_dir=None):
    """Return new skinned garment/detail objects; never modifies source body."""
    bpy.context.view_layer.update()
    body_world = body.matrix_world.copy()
    kd = KDTree(len(body.data.vertices))
    weights = []
    for vertex in body.data.vertices:
        kd.insert(body_world @ vertex.co, vertex.index)
        groups = [(body.vertex_groups[g.group].name, g.weight) for g in vertex.groups if g.weight > .001]
        groups = sorted(groups, key=lambda pair: pair[1], reverse=True)[:4]
        total = sum(w for _, w in groups)
        weights.append([(name, w / total) for name, w in groups] if total else [('pelvis', 1)])
    kd.balance()
    nearest = (kd, weights)
    cloth = _material('Native_Sweater_Fabric', (.012, .015, .022), .95)
    trouser_mat = _material('Native_Trousers_Fabric', (.016, .018, .021), .94)
    rib_mat = _material('Recreated_Black_Ribbing', (.009, .011, .016), .98)
    print_mat = _material('Sweatshirt_Offwhite_Print', (.56, .58, .55), .94)
    blue_mat = _material('Sweatshirt_Blue_Stripes', (.009, .028, .105), .95)
    shoe_mat = _material('Sneaker_Graphite_Fabric', (.055, .061, .069), .87)
    sole_mat = _material('Sneaker_Warm_Grey_Sole', (.32, .31, .28), .9)
    red_mat = _material('Sneaker_Muted_Red_Panels', (.21, .028, .024), .87)
    lace_mat = _material('Sneaker_Offwhite_Laces', (.5, .49, .44), .94)
    outfit = []

    sweater = _clone_surface(body, rig, 'Native_Sweater', cloth)
    _cut(sweater, (0, 0, .88), (0, 0, 1), outside=False)
    arms = []
    for side in ('l', 'r'):
        shoulder = _bone_point(rig, 'upperarm_' + side)
        elbow = _bone_point(rig, 'lowerarm_' + side)
        wrist = _bone_point(rig, 'hand_' + side)
        axis = (wrist - elbow).normalized()
        cuff = wrist - axis * .016
        _cut(sweater, cuff, axis)
        arms.extend([(shoulder, elbow), (elbow, wrist)])
    _relax(sweater, 14)
    world, inverse = sweater.matrix_world.copy(), sweater.matrix_world.inverted()
    for vertex in sweater.data.vertices:
        p = world @ vertex.co
        candidates = []
        for a, b in arms:
            ab = b - a
            t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
            c = a + ab * t
            candidates.append(((p - c).length, c))
        distance, center = min(candidates, key=lambda pair: pair[0])
        if abs(p.x) > .155 and distance < .085:
            direction = p - center
            if direction.length: p += direction.normalized() * .014
        else:
            radial = Vector((p.x, p.y + .015, 0))
            if radial.length: p += radial.normalized() * .018
            # Very small folds near the waistband, without imprinting anatomy.
            p.y += .002 * math.sin(p.z * 95 + p.x * 35) * math.exp(-((p.z - .95) / .09) ** 2)
        vertex.co = inverse @ p
    yoke = _upper_yoke(sweater, cloth, rig, nearest)
    # Weld the cloth yoke to the body-derived garment so shoulder weights and
    # normals agree at the seam when the native arms leave their A-pose.
    bpy.ops.object.select_all(action='DESELECT')
    sweater.select_set(True); yoke.select_set(True)
    bpy.context.view_layer.objects.active = sweater
    bpy.ops.object.join()
    bm = bmesh.new(); bm.from_mesh(sweater.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts),
                            dist=.00003 / max(abs(sweater.matrix_world.to_scale().x), .00001))
    bm.to_mesh(sweater.data); bm.free()
    _relax(sweater, 3)
    _smooth_elbow_cloth(sweater, rig)
    _web_sleeve_weights(sweater, rig)
    _finish_shell(sweater)
    outfit.append(sweater)

    trousers = _clone_surface(body, rig, 'Native_Trousers', trouser_mat)
    _cut(trousers, (0, 0, .93), (0, 0, 1))
    _cut(trousers, (0, 0, .095), (0, 0, 1), outside=False)
    _delete_region(trousers, lambda p: abs(p.x) > .26)
    _relax(trousers, 10)
    inverse = trousers.matrix_world.inverted()
    world = trousers.matrix_world.copy()
    for vertex in trousers.data.vertices:
        p = world @ vertex.co
        leg = 'l' if p.x > 0 else 'r'
        hip = _bone_point(rig, 'thigh_' + leg)
        foot = _bone_point(rig, 'foot_' + leg)
        t = max(0, min(1, (p.z - foot.z) / (hip.z - foot.z)))
        center = foot.lerp(hip, t)
        radial = Vector((p.x - center.x, p.y - center.y, 0))
        if p.z > .78: radial = Vector((p.x, p.y + .02, 0))
        if radial.length: p += radial.normalized() * (.011 if p.z < .7 else .014)
        if p.y < -.025 and .69 < p.z < .90:
            # A trouser fly is a fabric plane, not an imprint of skin anatomy.
            blend = math.exp(-((p.x / .09) ** 4)) * min(1, (p.z - .69) / .07)
            target_y = -.105 + .02 * min(1, abs(p.x) / .13) ** 2
            p.y = p.y * (1 - blend) + target_y * blend
        vertex.co = inverse @ p
    _finish_shell(trousers)
    outfit.append(trousers)

    # Clothing trims are attached by the same native body weights.
    outfit.append(_crewneck(rib_mat, rig))
    outfit.append(_ring('Sweatshirt_Waistband', (0, -.014, .89), (0, 0, 1), .169, .036, rib_mat, rig, nearest, .66))
    for side in ('l', 'r'):
        elbow, wrist = _bone_point(rig, 'lowerarm_' + side), _bone_point(rig, 'hand_' + side)
        axis = (wrist - elbow).normalized()
        cuff = _ring('Sweatshirt_Cuff_' + side, wrist - axis * .03, axis, .031, .038, rib_mat, rig, nearest, .86)
        _web_sleeve_weights(cuff, rig)
        outfit.append(cuff)

    # Project the graphic onto the recreated chest; the scan supplies no mesh.
    coords = [sweater.matrix_world @ v.co for v in sweater.data.vertices]
    bvh = BVHTree.FromPolygons(coords, [list(p.vertices) for p in sweater.data.polygons])

    def chest(x, z, offset=.001):
        hit, _, _, _ = bvh.ray_cast(Vector((x, -.6, z)), Vector((0, 1, 0)), 1.1)
        return Vector((x, (hit.y if hit else -.12) - offset, z))

    for z in (1.286, 1.128):
        vertices = []
        for i in range(49):
            x = -.125 + .25 * i / 48
            bend = .004 * math.sin(x * 20)
            vertices += [chest(x, z + bend - .0015), chest(x, z + bend + .0015)]
        stripe = _mesh('Sweatshirt_Blue_Line', vertices, [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(48)], blue_mat)
        _skin(stripe, rig, nearest)
        outfit.append(stripe)

    for text, z, width in [('HOLLISTER', 1.172, .22), ('1922', 1.145, .055)]:
        bpy.ops.object.select_all(action='DESELECT')
        font = bpy.data.curves.new('Sweatshirt_' + text, 'FONT')
        font.body = text
        font.align_x = 'CENTER'
        font.size = .03
        font.space_character = 1.2
        font.resolution_u = 4
        ob = bpy.data.objects.new('Sweatshirt_' + text, font)
        bpy.context.scene.collection.objects.link(ob)
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.convert(target='MESH')
        ob = bpy.context.object
        xs = [v.co.x for v in ob.data.vertices]
        scale = width / (max(xs) - min(xs))
        for v in ob.data.vertices: v.co = chest(v.co.x * scale, z + v.co.y * scale)
        ob.data.materials.append(print_mat)
        _skin(ob, rig, nearest)
        ob.select_set(False)
        outfit.append(ob)

    bird_outline = [(-.079,-.004),(-.060,.001),(-.036,.013),(-.016,.021),(-.004,.021),(.007,.009),(.025,.002),(.048,.004),(.077,.008),(.070,.000),(.045,-.008),(.026,-.007),(.013,-.002),(.004,-.010),(-.006,-.014),(-.028,-.008),(-.052,-.013),(-.072,-.010)]
    bird = _mesh('Sweatshirt_Bird_Emblem', [chest(x, 1.232+z) for x,z in bird_outline], [list(reversed(range(len(bird_outline))))], print_mat)
    _skin(bird, rig, nearest)
    outfit.append(bird)

    for side in ('l', 'r'):
        foot = _bone_point(rig, 'foot_' + side)
        ball = _bone_point(rig, 'ball_' + side)
        forward = ball - foot; forward.z = 0; forward.normalize()
        lateral = Vector((-forward.y, forward.x, 0))
        # longitudinal position, half width, height of rounded upper
        profile = [(-.071,.003,.032),(-.059,.032,.069),(-.033,.043,.103),(.005,.048,.105),(.05,.053,.083),(.105,.052,.064),(.17,.048,.050),(.215,.039,.041),(.243,.022,.029),(.250,.001,.021)]

        def shoe_point(t, x, z):
            p = foot + forward*t + lateral*x
            p.z = z
            return p

        verts, faces = [], []
        for t, width, height in profile:
            for j in range(17):
                a = j/16*math.pi
                verts.append(shoe_point(t, width*math.cos(a), .018+height*math.sin(a)))
        for i in range(len(profile)-1):
            for j in range(16): faces.append((i*17+j,i*17+j+1,(i+1)*17+j+1,(i+1)*17+j))
        faces.append(tuple(reversed(range(17))))
        faces.append(tuple((len(profile)-1)*17+j for j in range(17)))
        upper = _mesh('Sneaker_Upper_' + side, verts, faces, shoe_mat)
        _skin(upper, rig, bone='foot_' + side)
        outfit.append(upper)

        outline=[]
        for i in range(64):
            a=i/64*math.tau
            t=.088+.164*math.sin(a)
            x=.053*math.cos(a)*(.94+.06*math.sin(a))
            outline.append((t,x))
        verts=[shoe_point(t,x,z) for z in (-.006,.018) for t,x in outline]
        faces=[(i,(i+1)%64,64+(i+1)%64,64+i) for i in range(64)]
        faces += [tuple(reversed(range(64))),tuple(range(64,128))]
        sole=_mesh('Sneaker_Sole_' + side,verts,faces,sole_mat)
        _skin(sole,rig,bone='foot_'+side); outfit.append(sole)

        # Red side panels and heel accent recall the scanned low-top sneakers.
        for sign in (-1,1):
            patch=[shoe_point(t,sign*x,z) for t,x,z in [(-.033,.043,.034),(.02,.048,.036),(.11,.050,.031),(.16,.048,.028),(.05,.040,.070),(-.02,.034,.077)]]
            panel=_mesh('Sneaker_Red_Panel_'+side+'_'+str(sign),patch,[tuple(range(6))],red_mat)
            _skin(panel,rig,bone='foot_'+side); outfit.append(panel)
        def roof(t):
            for (a,_,h1),(b,_,h2) in zip(profile,profile[1:]):
                if a<=t<=b: return .018+h1+(h2-h1)*(t-a)/(b-a)
            return .08
        for i in range(5):
            t=-.015+i*.023
            points=[shoe_point(t,-.024,roof(t)-.010),shoe_point(t+.012,0,roof(t+.012)+.001),shoe_point(t+.023,.024,roof(t+.023)-.010)]
            outfit.append(_tube('Sneaker_Lace_'+side+'_'+str(i),points,.0017,lace_mat,rig,bone='foot_'+side))
    return outfit


def hide_covered_body(body, rig):
    """Keep native hands/wrists; the assembled face supplies neck/chest skin.

    Call only AFTER create_outfit. The retained wrist extends beneath each cuff
    so the new sleeve never reveals a hole at normal walking/gaze poses.
    """
    wrists = []
    for side in ('l', 'r'):
        elbow = _bone_point(rig, 'lowerarm_' + side)
        wrist = _bone_point(rig, 'hand_' + side)
        direction = (wrist - elbow).normalized()
        wrists.append((1 if side == 'l' else -1, wrist, direction))
    def covered(p):
        return not any(sign * p.x > .25 and (p - wrist).dot(direction) > -.035
                       for sign, wrist, direction in wrists)
    _delete_region(body, covered)


def hide_neck_under_clothes(face, rig):
    """Remove only the hidden chest skin below this sweater's crewneck.

    Call on the unscaled FaceMesh A after binding it to the native body rig.
    Geometry is evaluated in rest space, not the currently animated pose.
    The oblique plane leaves a 4 mm overlap under the ribbing. No jaw, chin,
    mouth, eyes or other facial surface is moved or removed: even the lowest
    chin vertices sit above this plane. UVs and native weights are preserved.
    """
    if face.type != 'MESH' or 'neck_01' not in rig.data.bones:
        raise ValueError('Expected the selected native MetaHuman face and rig')
    # Account for a translated whole-character root, without consulting the
    # animated neck/head pose. The matching source neck_01 rest Z is 1.383246.
    origin = _bone_point(rig, 'neck_01') - Vector((0, .02494, 1.383246))
    _cut(face, origin + Vector((0, .01, 1.391)), (0, -.2, 1), outside=False)
