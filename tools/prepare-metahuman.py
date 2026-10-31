"""Assemble the user's exported MetaHuman face with the original scanned outfit.

Run in Blender 5.2. Source assets and intermediate renders stay outside the site.
The existing scan rig drives walking and gaze; facial animation is not exported.
"""
import bpy, bmesh, math, os, sys, argparse, numpy as np
from mathutils import Vector, Matrix

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, help='Directory containing output/killian.fbx and metahuman exports')
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source, target = os.path.abspath(args.source), os.path.abspath(args.output)
os.makedirs(target, exist_ok=True)
mhdir = os.path.join(source, 'metahuman')
# Reuse the exact scan preparation and walk, stopping before its export/render.
original_argv = sys.argv[:]
sys.argv = ['prepare-avatar.py', '--', '--mesh', os.path.join(source,'output/killian.fbx'), '--texture', os.path.join(source,'output/M_Killian_Pichon_Tpose_diffuse.png'), '--output', target]
scan_script = os.path.join(os.path.dirname(__file__), 'prepare-avatar.py')
exec(compile(open(scan_script, encoding='utf-8').read().split('bpy.ops.object.select_all(action=')[0], scan_script, 'exec'))
sys.argv = original_argv
scan, scan_rig, scan_root = mesh, rig, root
scan.name = 'Scanned_Outfit'
for attr in list(scan.data.color_attributes): scan.data.color_attributes.remove(attr)

def cut_mesh(obj, predicate):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if predicate(obj.matrix_world @ v.co)], context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()

# The sweater collar stays intact. Only the old scan's head/neck is removed.
cut_mesh(scan, lambda p: p.z > 1.414)

def import_fbx(filename):
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(mhdir,filename),use_image_search=False)
    return set(bpy.context.scene.objects)-before

face_objects=import_fbx('MHI_Killian_Pichon_FaceMesh.fbx')
face=next(o for o in face_objects if o.type=='MESH')
face_rig=next(o for o in face_objects if o.type=='ARMATURE')
mh_head=face_rig.matrix_world @ face_rig.data.bones['head'].head_local
scan_head=scan_rig.matrix_world @ scan_rig.data.bones['BD_Head_jnt'].head_local
# Preserve the exported head's own proportions, fitted to the scan's neck joint.
fitting = Matrix.Translation(scan_head) @ Matrix.Scale(0.93,4) @ Matrix.Translation(-mh_head)

def fit_and_skin(obj, name, neck_blend=False):
    world = fitting @ obj.matrix_world
    obj.parent=None; obj.matrix_world=Matrix.Identity(4)
    obj.data.transform(world)
    obj.modifiers.clear(); obj.vertex_groups.clear()
    head_group=obj.vertex_groups.new(name='BD_Head_jnt')
    neck_group=obj.vertex_groups.new(name='BD_Neck_jnt') if neck_blend else None
    for v in obj.data.vertices:
        w=max(0,min(1,(v.co.z-1.418)/0.055)) if neck_blend else 1
        if w: head_group.add([v.index],w,'REPLACE')
        if w<1: neck_group.add([v.index],1-w,'REPLACE')
    mod=obj.modifiers.new('Follow_scan_skeleton','ARMATURE'); mod.object=scan_rig
    # Parent to the original bobbing root, retaining the world-space mesh.
    obj.parent=scan_rig; obj.matrix_parent_inverse=scan_rig.matrix_world.inverted()
    obj.name=name
    for p in obj.data.polygons: p.use_smooth=True
    return obj

def image_texture(name, size, normal=False):
    im=bpy.data.images.load(os.path.join(mhdir,name+'.png'),check_existing=False)
    im.colorspace_settings.name='Non-Color' if normal else 'sRGB'
    im.scale(size,size)
    if normal:
        px=np.empty(size*size*4,dtype=np.float32); im.pixels.foreach_get(px)
        px[1::4]=1-px[1::4]; im.pixels.foreach_set(px)
    im.filepath_raw=os.path.join(target,name+('.png' if normal else '.jpg'))
    im.file_format='PNG' if normal else 'JPEG'; im.save()
    return im

def principled(name,color,roughness):
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Specular IOR Level'].default_value=.25
    return mat,bs

skin,bs=principled('MetaHuman_Skin',(.65,.35,.25),.62)
tex=skin.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image_texture('FaceColor_MAIN',2048)
skin.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
tex=skin.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image_texture('FaceNormal_MAIN',512,True)
nm=skin.node_tree.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.55
skin.node_tree.links.new(tex.outputs['Color'],nm.inputs['Color']); skin.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
teeth,tbs=principled('Teeth',(.48,.41,.33),.6)
eyes,ebs=principled('Eyes',(.55,.52,.48),.22)
eye_color=eyes.node_tree.nodes.new('ShaderNodeVertexColor'); eye_color.layer_name='EyeColor'
eyes.node_tree.links.new(eye_color.outputs['Color'],ebs.inputs['Base Color'])
mouth,mbs=principled('Mouth_Interior',(.07,.015,.012),.7)

# Keep skin, teeth and eyes. Unreal's tear-film/occlusion overlays require engine shaders.
bm=bmesh.new(); bm.from_mesh(face.data)
bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index not in [0,1,3,4]],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(face.data); bm.free()
eye_centers={3:face_rig.matrix_world@face_rig.data.bones['FACIAL_L_Eye'].head_local,4:face_rig.matrix_world@face_rig.data.bones['FACIAL_R_Eye'].head_local}
for attr in list(face.data.color_attributes): face.data.color_attributes.remove(attr)
colors=face.data.color_attributes.new(name='EyeColor',type='FLOAT_COLOR',domain='CORNER')
part_indices=[]
for poly in face.data.polygons:
    idx=poly.material_index
    for li in poly.loop_indices:
        p=face.matrix_world @ face.data.vertices[face.data.loops[li].vertex_index].co
        color=(1,1,1,1)
        if idx in eye_centers:
            color=(.53,.50,.46,1)
            c=eye_centers[idx]; radius=math.hypot(p.x-c.x,p.z-c.z)
            if p.y<c.y-.004 and radius<.006:
                color=(.025,.04,.03,1) if radius>.0028 else (.004,.005,.004,1)
        colors.data[li].color=color
    part_indices.append({0:0,1:1,3:2,4:2}.get(idx,3))
face.data.materials.clear()
for mat in [skin,teeth,eyes,mouth]: face.data.materials.append(mat)
for poly,idx in zip(face.data.polygons,part_indices): poly.material_index=idx
face.shape_key_clear()
fit_and_skin(face,'MetaHuman_Face',True)
cut_mesh(face,lambda p:p.z<1.385 or (p.z<1.465 and abs(p.x-scan_head.x)>.055))
# Taper the hidden base of the neck inside the sweater instead of showing chest skin.
for v in face.data.vertices:
    if v.co.z<1.44:
        blend=min(1,(1.44-v.co.z)/.06)
        v.co.x=scan_head.x+(v.co.x-scan_head.x)*(1-.18*blend)
        v.co.y=-.03+(v.co.y+.03)*(1-.65*blend)
bpy.context.view_layer.objects.active=face
reduction=face.modifiers.new('Web_face_detail','DECIMATE'); reduction.ratio=.55
bpy.ops.object.modifier_apply(modifier=reduction.name)
# Remove unused source facial skeleton (the browser uses the scan's head joint).
for obj in face_objects:
    if obj!=face: bpy.data.objects.remove(obj,do_unlink=True)

assembled=[scan,face]
# Rebuild the hidden collar edge where two independently authored bodies meet.
collar_mat,cbs=principled('Sweater_Collar',(.008,.010,.013),.95)
bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=10,location=(scan_head.x,-.03,1.405),major_radius=.061,minor_radius=.010)
collar=bpy.context.object; collar.scale=(1,.88,.8)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# The collar is already in scan space; temporarily bypass the head fitting.
saved_fitting=fitting; fitting=Matrix.Identity(4)
fit_and_skin(collar,'Sweater_Collar',True); fitting=saved_fitting
collar.data.materials.append(collar_mat); assembled.append(collar)
for label,prefix,color,size in [
    ('Hair','Hair_M_BobStraight',(.13,.075,.037),1024),
    ('Beard','Beard_S_Full',(.28,.12,.035),512),
    ('Moustache','Mustache_S_Full',(.28,.12,.035),512),
    ('Eyebrows','Eyebrows_M_FlatThick',(.11,.05,.023),512)]:
    objects=import_fbx(prefix+'_CardsMesh_Group0_LOD1.fbx')
    obj=next(o for o in objects if o.type=='MESH')
    fit_and_skin(obj,'MetaHuman_'+label)
    while len(obj.data.uv_layers)>1: obj.data.uv_layers.remove(obj.data.uv_layers[-1])
    for attr in list(obj.data.color_attributes): obj.data.color_attributes.remove(attr)
    # Compact UE card layout stores coverage in the attribute texture's red channel.
    atlas=bpy.data.images.load(os.path.join(mhdir,prefix+'_CardsAtlas_Attribute.png'),check_existing=False)
    atlas.colorspace_settings.name='Non-Color'; atlas.scale(size,size)
    px=np.empty(size*size*4,dtype=np.float32); atlas.pixels.foreach_get(px); px=px.reshape(-1,4)
    coverage=px[:,0].copy(); seed=px[:,2].copy()
    for channel in range(3): px[:,channel]=color[channel]*(.72+.55*seed)
    px[:,3]=coverage
    atlas.pixels.foreach_set(px.reshape(-1)); atlas.filepath_raw=os.path.join(target,label.lower()+'.png'); atlas.file_format='PNG'; atlas.save()
    mat,hbs=principled('MetaHuman_'+label,color,.72)
    mat.surface_render_method='DITHERED'; mat.use_backface_culling=False
    tx=mat.node_tree.nodes.new('ShaderNodeTexImage'); tx.image=atlas
    mat.node_tree.links.new(tx.outputs['Color'],hbs.inputs['Base Color']); mat.node_tree.links.new(tx.outputs['Alpha'],hbs.inputs['Alpha'])
    obj.data.materials.clear(); obj.data.materials.append(mat)
    for poly in obj.data.polygons: poly.material_index=0
    assembled.append(obj)

# Rounded acetate frame based on the supplied photo, built in the MetaHuman's space.
frame_mat,fbs=principled('Dark_Tortoiseshell_Acetate',(.012,.009,.006),.23)
fbs.inputs['Coat Weight'].default_value=.45
lens_mat,lbs=principled('Clear_Lenses',(.8,.88,.9),.08)
lbs.inputs['Alpha'].default_value=.025
lens_mat.surface_render_method='DITHERED'

def tube(name,points,radius,cyclic=False):
    bpy.ops.object.select_all(action='DESELECT')
    curve=bpy.data.curves.new(name,'CURVE'); curve.dimensions='3D'; curve.resolution_u=2
    curve.bevel_depth=radius; curve.bevel_resolution=3
    sp=curve.splines.new('POLY'); sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points): p.co=(*co,1)
    sp.use_cyclic_u=cyclic
    obj=bpy.data.objects.new(name,curve); scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    bpy.ops.object.convert(target='MESH'); obj=bpy.context.object
    obj.data.materials.append(frame_mat)
    fit_and_skin(obj,name); assembled.append(obj); obj.select_set(False)

eye_z=(eye_centers[3].z+eye_centers[4].z)/2
front_y=-.125
for sign in [-1,1]:
    cx=sign*.034
    points=[]
    for i in range(80):
        a=i/80*math.tau
        x=cx+.028*math.copysign(abs(math.cos(a))**.65,math.cos(a))
        z=eye_z+.023*math.copysign(abs(math.sin(a))**.7,math.sin(a))
        # Slight face wrap, strongest at the temples.
        y=front_y+.010*(x/.075)**2
        points.append((x,y,z))
    tube('Glasses_Rim_'+str(sign),points,.0026,True)
    tube('Glasses_Temple_'+str(sign),[(sign*.064,front_y+.007,eye_z+.015),(sign*.074,-.085,eye_z+.013),(sign*.078,-.025,eye_z+.007),(sign*.077,.004,eye_z-.011)],.0025)
    data=bpy.data.meshes.new('Lens'); data.from_pydata(points,[],[list(range(len(points)))]); data.update()
    lens=bpy.data.objects.new('Glasses_Clear_Lens_'+str(sign),data); scene.collection.objects.link(lens); data.materials.append(lens_mat)
    fit_and_skin(lens,lens.name); assembled.append(lens)
tube('Glasses_Bridge',[(-.008,front_y-.002,eye_z+.010),(0,front_y-.005,eye_z+.014),(.008,front_y-.002,eye_z+.010)],.003)

# FBX import changes the scene frame rate; restore the original 1.6 s walk.
scene.render.fps=30; scene.render.fps_base=1; scene.frame_start=1; scene.frame_end=49
scene.frame_set(7); bpy.context.view_layer.update()
scan_rig['avatar_source']='MetaHuman face with scanned outfit; reference-shaped glasses'
bpy.ops.object.select_all(action='DESELECT')
for obj in assembled+[scan_rig,scan_root]: obj.select_set(True)
bpy.context.view_layer.objects.active=scan_rig
bpy.ops.export_scene.gltf(filepath=os.path.join(target,'killian-metahuman.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_image_format='AUTO',export_jpeg_quality=88,export_extras=False,export_skins=True,export_morph=False,export_yup=True,export_all_vertex_colors=False,export_vertex_color='MATERIAL')

scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=720; scene.render.resolution_y=960; scene.render.resolution_percentage=100
scene.render.film_transparent=True; scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
world=bpy.data.worlds.new('Studio'); world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.55,.65,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35; scene.world=world
for name,pos,power,size in [('Key',(-2,-3,3),220,2),('Fill',(2,-1,2),70,2),('Rim',(1,2,3),180,2)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    ob=bpy.data.objects.new(name,data); scene.collection.objects.link(ob); ob.location=pos
    ob.rotation_euler=(Vector((0,0,1.1))-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-3.4,.91)); camera=bpy.context.object; scene.camera=camera
camera.rotation_euler=(Vector((0,0,.84))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=2.06
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=os.path.join(target,'metahuman-preview.png'); bpy.ops.render.render(write_still=True)
camera.location=(scan_head.x,-2.8,1.54); camera.rotation_euler=(Vector((scan_head.x,-.02,1.49))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.ortho_scale=.56
scene.render.filepath=os.path.join(target,'metahuman-detail.png'); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(target,'metahuman-web.blend'))
