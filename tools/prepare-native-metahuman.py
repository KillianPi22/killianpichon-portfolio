"""Build the selected original MetaHuman, clothed on its own body and skeleton.

Blender 5.2. Source FBX files and preparation output stay outside the public repo.
No scanned geometry, scanned texture or scanned skeleton is loaded here.
"""
import argparse, os, sys, math, json
import bpy, bmesh, numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

sys.dont_write_bytecode=True
sys.path.insert(0, os.path.dirname(__file__))
from metahuman_garments import create_outfit, hide_covered_body, hide_neck_under_clothes

parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source=os.path.abspath(args.source); output=os.path.abspath(args.output)
os.makedirs(output,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene

def import_fbx(folder,name):
    before=set(scene.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(source,folder,name+'.fbx'),use_image_search=False)
    return set(scene.objects)-before

original=import_fbx('native-metahuman','m_srt_nrw_body')
rig=next(o for o in original if o.type=='ARMATURE'); rig.name='Native_MetaHuman_Rig'
body=next(o for o in original if o.type=='MESH'); body.name='Native_MetaHuman_Hands'
root=next(o for o in original if o.type=='EMPTY'); root.name='Native_MetaHuman_Root'

def material(name,color,roughness=.65):
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Specular IOR Level'].default_value=.25
    return mat,bs

def texture(mat,bs,folder,name,size,normal=False):
    im=bpy.data.images.load(os.path.join(source,folder,name+'.png'),check_existing=False)
    im.colorspace_settings.name='Non-Color' if normal else 'sRGB'; im.scale(size,size)
    if normal:
        pixels=np.empty(size*size*4,dtype=np.float32); im.pixels.foreach_get(pixels)
        pixels[1::4]=1-pixels[1::4]; im.pixels.foreach_set(pixels)
    im.filepath_raw=os.path.join(output,name+('.png' if normal else '.jpg'))
    im.file_format='PNG' if normal else 'JPEG'; im.save()
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=im
    if normal:
        norm=mat.node_tree.nodes.new('ShaderNodeNormalMap'); norm.inputs['Strength'].default_value=.55
        mat.node_tree.links.new(tex.outputs['Color'],norm.inputs['Color']); mat.node_tree.links.new(norm.outputs['Normal'],bs.inputs['Normal'])
    else: mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])

hands,hbs=material('Native_Body_Skin',(.6,.3,.2))
texture(hands,hbs,'native-metahuman','BodyBaseColor',1024)
body.data.materials.clear();body.data.materials.append(hands)
for p in body.data.polygons:p.material_index=0
for attr in list(body.data.color_attributes):body.data.color_attributes.remove(attr)
outfit=create_outfit(body,rig,output)
hide_covered_body(body,rig)

face_objects=import_fbx('metahuman','MHI_Killian_Pichon_FaceMesh')
face=next(o for o in face_objects if o.type=='MESH')
face_rig=next(o for o in face_objects if o.type=='ARMATURE')
head_world=rig.matrix_world@rig.data.bones['head'].head_local
source_head=face_rig.matrix_world@face_rig.data.bones['head'].head_local
assert (head_world-source_head).length<.00001, 'Selected face must match original body without rescaling'
eye_centers={3:face_rig.matrix_world@face_rig.data.bones['FACIAL_L_Eye'].head_local,4:face_rig.matrix_world@face_rig.data.bones['FACIAL_R_Eye'].head_local}

skin,sbs=material('MetaHuman_Skin',(.65,.35,.25),.62)
texture(skin,sbs,'metahuman','FaceColor_MAIN',2048)
texture(skin,sbs,'metahuman','FaceNormal_MAIN',512,True)
teeth,_=material('Teeth',(.48,.41,.33),.6)
eyes,ebs=material('Eyes',(.55,.52,.48),.22)
vc=eyes.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='EyeColor';eyes.node_tree.links.new(vc.outputs['Color'],ebs.inputs['Base Color'])
bm=bmesh.new();bm.from_mesh(face.data)
bmesh.ops.delete(bm,geom=[p for p in bm.faces if p.material_index not in [0,1,3,4]],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(face.data);bm.free()
for attr in list(face.data.color_attributes):face.data.color_attributes.remove(attr)
colors=face.data.color_attributes.new(name='EyeColor',type='FLOAT_COLOR',domain='CORNER')
indices=[]
for p in face.data.polygons:
    idx=p.material_index;indices.append({0:0,1:1,3:2,4:2}[idx])
    for li in p.loop_indices:
        pos=face.matrix_world@face.data.vertices[face.data.loops[li].vertex_index].co; color=(1,1,1,1)
        if idx in eye_centers:
            c=eye_centers[idx];rad=math.hypot(pos.x-c.x,pos.z-c.z);color=(.53,.50,.46,1)
            if pos.y<c.y-.004 and rad<.006:color=(.025,.04,.03,1) if rad>.0028 else (.004,.005,.004,1)
        colors.data[li].color=color
face.data.materials.clear()
for mat in [skin,teeth,eyes]:face.data.materials.append(mat)
for p,i in zip(face.data.polygons,indices):p.material_index=i;p.use_smooth=True

# Collapse only facial-control influences to native body ancestors. The neutral
# face vertices, head proportions and neck connection are left unchanged.
mapping={}
for group in face.vertex_groups:
    bone=face_rig.data.bones.get(group.name)
    while bone and bone.name not in rig.data.bones:bone=bone.parent
    mapping[group.index]=bone.name if bone else 'head'
weights=[]
for v in face.data.vertices:
    merged={}
    for g in v.groups:
        name=mapping[g.group];merged[name]=merged.get(name,0)+g.weight
    weights.append(merged)

def bind(obj,name,weights=None,bone='head'):
    world=obj.matrix_world.copy();obj.parent=None;obj.modifiers.clear();obj.shape_key_clear()
    obj.data.transform(world);obj.matrix_world=Matrix.Identity(4);obj.vertex_groups.clear()
    groups={}
    for v in obj.data.vertices:
        values=weights[v.index] if weights else {bone:1}
        values=sorted(values.items(),key=lambda kv:kv[1],reverse=True)[:4]; total=sum(w for _,w in values)
        for key,w in values:
            if key not in groups:groups[key]=obj.vertex_groups.new(name=key)
            if w>0:groups[key].add([v.index],w/total,'REPLACE')
    obj.parent=rig;obj.matrix_parent_inverse=rig.matrix_world.inverted()
    mod=obj.modifiers.new('Native_MetaHuman_Skin','ARMATURE');mod.object=rig
    obj.name=name
    for p in obj.data.polygons:p.use_smooth=True
    return obj

bind(face,'Native_MetaHuman_Face',weights)
hide_neck_under_clothes(face,rig)
for obj in face_objects:
    if obj!=face:bpy.data.objects.remove(obj,do_unlink=True)
assembled=[body,face]+outfit

def soften_hair_part(obj):
    """Bring existing root cards closer, with a smooth falloff into the lengths."""
    for vertex in obj.data.vertices:
        p=vertex.co
        t=max(0,min(1,(p.z-1.56)/.055))
        blend=t*t*(3-2*t)*math.exp(-((p.y+.015)/.16)**6)
        distance=p.x-.001
        p.x-=.0034*math.tanh(distance/.004)*math.exp(-(distance/.026)**2)*blend
        p.z+=.0015*math.exp(-(distance/.018)**2)*blend

for label,prefix,color,size in [('Hair','Hair_M_BobStraight',(.13,.075,.037),1024),('Beard','Beard_S_Full',(.28,.12,.035),512),('Moustache','Mustache_S_Full',(.28,.12,.035),512),('Eyebrows','Eyebrows_M_FlatThick',(.11,.05,.023),512)]:
    objects=import_fbx('metahuman',prefix+'_CardsMesh_Group0_LOD1');obj=next(o for o in objects if o.type=='MESH')
    bind(obj,'MetaHuman_'+label)
    if label=='Hair':soften_hair_part(obj)
    while len(obj.data.uv_layers)>1:obj.data.uv_layers.remove(obj.data.uv_layers[-1])
    for attr in list(obj.data.color_attributes):obj.data.color_attributes.remove(attr)
    atlas=bpy.data.images.load(os.path.join(source,'metahuman',prefix+'_CardsAtlas_Attribute.png'),check_existing=False)
    atlas.colorspace_settings.name='Non-Color';atlas.scale(size,size)
    px=np.empty(size*size*4,dtype=np.float32);atlas.pixels.foreach_get(px);px=px.reshape(-1,4)
    coverage=px[:,0].copy();seed=px[:,2].copy()
    for channel in range(3):px[:,channel]=color[channel]*(.72+.55*seed)
    px[:,3]=coverage;atlas.pixels.foreach_set(px.reshape(-1))
    atlas.filepath_raw=os.path.join(output,label.lower()+'.png');atlas.file_format='PNG';atlas.save()
    mat,bs=material('MetaHuman_'+label,color,.83 if label=='Hair' else .72);mat.surface_render_method='DITHERED';mat.use_backface_culling=False
    tx=mat.node_tree.nodes.new('ShaderNodeTexImage');tx.image=atlas
    mat.node_tree.links.new(tx.outputs['Color'],bs.inputs['Base Color']);mat.node_tree.links.new(tx.outputs['Alpha'],bs.inputs['Alpha'])
    obj.data.materials.clear();obj.data.materials.append(mat)
    for p in obj.data.polygons:p.material_index=0
    assembled.append(obj)

frame_mat,fbs=material('Dark_Tortoiseshell_Acetate',(.012,.009,.006),.23);fbs.inputs['Coat Weight'].default_value=.45
lens_mat,lbs=material('Clear_Lenses',(.8,.88,.9),.08);lbs.inputs['Alpha'].default_value=.025;lens_mat.surface_render_method='DITHERED'
def tube(name,points,radius,cyclic=False):
    bpy.ops.object.select_all(action='DESELECT')
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=3
    sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    sp.use_cyclic_u=cyclic;obj=bpy.data.objects.new(name,curve);scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj=bpy.context.object
    obj.data.materials.append(frame_mat);bind(obj,name);assembled.append(obj)
eye_z=(eye_centers[3].z+eye_centers[4].z)/2;front_y=-.125
for sign in [-1,1]:
    points=[]
    for i in range(80):
        a=i/80*math.tau;x=sign*.034+.028*math.copysign(abs(math.cos(a))**.65,math.cos(a));z=eye_z+.023*math.copysign(abs(math.sin(a))**.7,math.sin(a));points.append((x,front_y+.010*(x/.075)**2,z))
    tube('Glasses_Rim_'+str(sign),points,.0026,True)
    tube('Glasses_Temple_'+str(sign),[(sign*.064,front_y+.007,eye_z+.015),(sign*.074,-.085,eye_z+.013),(sign*.078,-.025,eye_z+.007),(sign*.077,.004,eye_z-.011)],.0025)
    data=bpy.data.meshes.new('Lens');data.from_pydata(points,[],[list(range(len(points)))]);data.update()
    obj=bpy.data.objects.new('Glasses_Clear_Lens_'+str(sign),data);scene.collection.objects.link(obj);data.materials.append(lens_mat);bind(obj,obj.name);assembled.append(obj)
tube('Glasses_Bridge',[(-.008,front_y-.002,eye_z+.010),(0,front_y-.005,eye_z+.014),(.008,front_y-.002,eye_z+.010)],.003)

# Pose the original MetaHuman arms at the sides, then add a bounded walk loop.
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion()
def aim(bone,child,target):
    bpy.context.view_layer.update();pb=rig.pose.bones[bone];end=rig.pose.bones[child]
    direction=(rig.matrix_world.to_3x3()@(end.head-pb.head)).normalized()
    world=(rig.matrix_world@pb.matrix).to_quaternion()
    pb.rotation_quaternion @= world.inverted()@direction.rotation_difference(Vector(target).normalized())@world
for side,sign in [('l',1),('r',-1)]:
    aim('upperarm_'+side,'lowerarm_'+side,(sign*.24,0,-1))
    aim('lowerarm_'+side,'hand_'+side,(sign*.10,-.10,-1))
bpy.context.view_layer.update()
base={p.name:p.rotation_quaternion.copy() for p in rig.pose.bones}
scene.render.fps=30;scene.render.fps_base=1;scene.frame_start=1;scene.frame_end=49
def local_delta(pb,axis,angle):
    rest=(rig.matrix_world@pb.bone.matrix_local).to_quaternion()
    return rest.inverted()@Quaternion(axis,angle)@rest
for frame in range(1,50):
    phase=(frame-1)/48*math.tau
    for pb in rig.pose.bones:pb.rotation_quaternion=base[pb.name]
    for side,offset in [('l',0),('r',math.pi)]:
        p=phase+offset
        for joint,angle in [('thigh',-.28*math.sin(p)),('calf',.06+.48*max(0,math.cos(p))),('foot',-.06-.16*max(0,math.cos(p))),('upperarm',.20*math.sin(p))]:
            pb=rig.pose.bones[joint+'_'+side]
            pb.rotation_quaternion=local_delta(pb,(1,0,0),angle)@base[pb.name];pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
    root.location.z=.007*math.cos(phase*2);root.keyframe_insert('location',frame=frame)
rig.animation_data.action.name='Native_Walk_In_Place';root.animation_data.action.name='Native_Walk_In_Place'

def check_hand_clearance(scene, hands, trousers):
    """Check the actual deformed surfaces throughout the exported walk loop."""
    measurements=[]
    for frame in range(scene.frame_start,scene.frame_end+1):
        scene.frame_set(frame)
        graph=bpy.context.evaluated_depsgraph_get()
        skin=hands.evaluated_get(graph);cloth=trousers.evaluated_get(graph)
        bvh=BVHTree.FromPolygons([cloth.matrix_world@v.co for v in cloth.data.vertices],
                                 [list(p.vertices) for p in cloth.data.polygons])
        clearance=float('inf');penetrations=0
        for vertex in skin.data.vertices:
            point=skin.matrix_world@vertex.co
            nearest,normal,_,distance=bvh.find_nearest(point)
            clearance=min(clearance,distance)
            if distance<.04 and (point-nearest).dot(normal)<-.00001:penetrations+=1
        measurements.append({'frame':frame,'clearance_m':clearance,'penetrating_vertices':penetrations})
    minimum=min(row['clearance_m'] for row in measurements)
    assert minimum>=.008, 'Hands must stay at least 8 mm clear of the trousers'
    assert not any(row['penetrating_vertices'] for row in measurements), 'Hand/trouser intersection'
    return {'minimum_clearance_m':minimum,'frames':measurements}

clearance=check_hand_clearance(scene,body,bpy.data.objects['Native_Trousers'])
with open(os.path.join(output,'hand-clearance.json'),'w') as report:json.dump(clearance,report,indent=2)
print('MINIMUM_HAND_CLEARANCE_MM',round(clearance['minimum_clearance_m']*1000,2))
scene.frame_set(7);bpy.context.view_layer.update()
rig['source']='Original m_srt_nrw_body skeleton and unscaled MHI_Killian_Pichon_FaceMesh (A).'
rig['outfit']='Reconstructed garments; no scanned mesh or scan skeleton.'
bpy.ops.object.select_all(action='DESELECT')
for obj in assembled+[rig,root]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=os.path.join(output,'killian-native-metahuman.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_image_format='AUTO',export_jpeg_quality=88,export_extras=False,export_skins=True,export_morph=False,export_yup=True,export_all_vertex_colors=False,export_vertex_color='MATERIAL')

scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=720;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
world=bpy.data.worlds.new('Studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.55,.65,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
for name,pos,power,size in [('Key',(-2,-3,3),220,2),('Fill',(2,-1,2),70,2),('Rim',(1,2,3),180,2)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,1.1))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-3.4,.91));camera=bpy.context.object;scene.camera=camera;camera.rotation_euler=(Vector((0,0,.84))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.1
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=os.path.join(output,'native-metahuman-preview.png');bpy.ops.render.render(write_still=True)
camera.location=(0,-2.8,1.54);camera.rotation_euler=(Vector((0,-.02,1.47))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.62
scene.render.filepath=os.path.join(output,'native-metahuman-detail.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output,'native-metahuman.blend'))
