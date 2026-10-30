import bpy, math, os, argparse, sys
from mathutils import Vector, Quaternion

parser = argparse.ArgumentParser(description='Prepare the full-body scan for the portfolio.')
parser.add_argument('--mesh', required=True)
parser.add_argument('--texture', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = target = os.path.abspath(args.output)
os.makedirs(target, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.abspath(args.mesh), use_image_search=False)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
root = next(o for o in bpy.context.scene.objects if o.type == 'EMPTY')
rig.name = 'Killian_Rig'
mesh.name = 'Killian'

material = bpy.data.materials.new('Killian_Scan')
material.use_nodes = True
nodes = material.node_tree.nodes
links = material.node_tree.links
bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = 0.85
bsdf.inputs['Specular IOR Level'].default_value = 0.25
texture = nodes.new('ShaderNodeTexImage')
texture.image = bpy.data.images.load(os.path.abspath(args.texture))
texture.image.scale(2048, 2048)
texture.image.filepath_raw = os.path.join(out, 'basecolor.jpg')
texture.image.file_format = 'JPEG'
bpy.context.scene.render.image_settings.quality = 88
texture.image.save()
links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
mesh.data.materials.clear()
mesh.data.materials.append(material)

# The source skeleton uses arbitrary joint axes. Calculate offsets in its rest space.
def local_delta(pb, axis, angle):
    rest = (rig.matrix_world @ pb.bone.matrix_local).to_quaternion()
    return rest.inverted() @ Quaternion(axis, angle) @ rest

base = {}
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    base[pb.name] = Quaternion()
for side, sign in [('R', -1), ('L', 1)]:
    shoulder = rig.pose.bones[f'{side}_BD_NB_Shoulder_jnt']
    elbow = rig.pose.bones[f'{side}_BD_NB_Forearm_Twist_01_jnt']
    direction = (rig.matrix_world.to_3x3() @ (elbow.bone.head_local - shoulder.bone.head_local)).normalized()
    desired = Vector((sign * 0.17, -0.04, -0.98)).normalized()
    rest = (rig.matrix_world @ shoulder.bone.matrix_local).to_quaternion()
    base[shoulder.name] = rest.inverted() @ direction.rotation_difference(desired) @ rest
    hip = rig.pose.bones[f'{side}_BD_NB_Hip_jnt']
    knee = rig.pose.bones[f'{side}_BD_NB_Knee_jnt']
    direction = (rig.matrix_world.to_3x3() @ (knee.bone.head_local - hip.bone.head_local)).normalized()
    rest = (rig.matrix_world @ hip.bone.matrix_local).to_quaternion()
    base[hip.name] = rest.inverted() @ direction.rotation_difference(Vector((sign * 0.035, 0, -1)).normalized()) @ rest

scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 49
for frame in range(1, 50):
    phase = (frame - 1) / 48 * math.tau
    for pb in rig.pose.bones: pb.rotation_quaternion = base[pb.name]
    for side, offset in [('R', 0), ('L', math.pi)]:
        p = phase + offset
        hip = rig.pose.bones[f'{side}_BD_NB_Hip_jnt']
        knee = rig.pose.bones[f'{side}_BD_NB_Knee_jnt']
        ankle = rig.pose.bones[f'{side}_BD_NB_Ankle_jnt']
        shoulder = rig.pose.bones[f'{side}_BD_NB_Shoulder_jnt']
        hip.rotation_quaternion = local_delta(hip, (1, 0, 0), -0.30 * math.sin(p)) @ base[hip.name]
        knee.rotation_quaternion = local_delta(knee, (1, 0, 0), 0.10 + 0.52 * max(0, math.cos(p))) @ base[knee.name]
        ankle.rotation_quaternion = local_delta(ankle, (1, 0, 0), -0.07 - 0.20 * max(0, math.cos(p)))
        shoulder.rotation_quaternion = local_delta(shoulder, (1, 0, 0), 0.22 * math.sin(p)) @ base[shoulder.name]
    for pb in rig.pose.bones:
        if 'Hip_jnt' in pb.name or 'Knee_jnt' in pb.name or 'Ankle_jnt' in pb.name or 'Shoulder_jnt' in pb.name:
            pb.keyframe_insert('rotation_quaternion', frame=frame, group=pb.name)
    # A small vertical weight transfer, with no forward root motion.
    root.location.z = 0.009 * math.cos(phase * 2)
    root.keyframe_insert('location', frame=frame)
rig.animation_data.action.name = 'Walk_In_Place'
root.animation_data.action.name = 'Walk_In_Place'
scene.frame_set(7)
bpy.context.view_layer.update()

# Store a neutral orientation for the head; the browser adds gaze after the walk.
rig['avatar_source'] = 'SKM_Killian_Pichon'
rig['walk_note'] = 'Procedural in-place walk created for the portfolio; source Unreal assets preserved.'
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
mesh.select_set(True)
root.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=os.path.join(target, 'killian-avatar.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_image_format='JPEG', export_jpeg_quality=88, export_extras=False, export_skins=True, export_morph=False, export_yup=True)

scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 720
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
world = bpy.data.worlds.new('Studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.65, 0.68, 0.74, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.5
scene.world = world

deps = bpy.context.evaluated_depsgraph_get()
em = mesh.evaluated_get(deps)
coords = [em.matrix_world @ v.co for v in em.data.vertices]
bounds = [[min(c[i] for c in coords), max(c[i] for c in coords)] for i in range(3)]
print('BOUNDS', bounds)
center_z = (bounds[2][0] + bounds[2][1]) / 2
bpy.ops.object.camera_add(location=(0, -3.4, center_z + 0.07))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, center_z)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.06
scene.camera = camera
for name, pos, power, size in [('Key',(-2,-3,3),250,3),('Fill',(2,-1,2),100,2),('Rim',(1,2,3),200,2)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    ob=bpy.data.objects.new(name,data); scene.collection.objects.link(ob); ob.location=pos
    ob.rotation_euler=(Vector((0,0,center_z))-ob.location).to_track_quat('-Z','Y').to_euler()
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=os.path.join(out,'avatar-preview.png')
bpy.ops.render.render(write_still=True)
# Keep source FBX and preparation output outside the public repository.
