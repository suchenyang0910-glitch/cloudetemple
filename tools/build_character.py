import bpy, math, os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'artifacts')
os.makedirs(OUT, exist_ok=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)

def mat(name, color, rough=0.8):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough
    return m
skin=mat('skin',(0.52,0.25,0.16)); shirt=mat('ao_ba_ba_cream',(0.78,0.68,0.52)); pants=mat('deep_brown',(0.16,0.11,0.09)); hair=mat('bun_hair',(0.055,0.035,0.028)); dark=mat('face_ink',(0.015,0.009,0.008)); wood=mat('hall_wood',(0.28,0.18,0.11)); outline=mat('outline',(0.012,0.008,0.006))

def cube(n, loc, scale, material, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=n; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel: mod=o.modifiers.new('soft_cartoon_edges','BEVEL'); mod.width=bevel; mod.segments=2
    o.data.materials.append(material); return o
def uv(n, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=loc); o=bpy.context.object; o.name=n; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material); return o
def cyl(n, loc, radius, depth, material):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=depth, location=loc); o=bpy.context.object; o.name=n; o.data.materials.append(material); return o

# Armature
bpy.ops.object.armature_add( location=(0,0,0)); arm=bpy.context.object; arm.name='visitor_armature'; arm.data.name='visitor_skeleton'; arm.show_in_front=True
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT'); eb=arm.data.edit_bones; root=eb[0]; root.name='root'; root.head=(0,0,0); root.tail=(0,0.2,0)
def bone(name, head, tail, parent='root'):
    b=eb.new(name); b.head=head; b.tail=tail; b.parent=eb.get(parent); return b
bone('spine',(0,0.2,0),(0,1.55,0)); bone('head',(0,1.55,0),(0,2.2,0),'spine')
bone('upper_arm.L',(-.28,1.42,0),(-.52,1.1,0),'spine'); bone('forearm.L',(-.52,1.1,0),(-.48,.85,.04),'upper_arm.L')
bone('upper_arm.R',(.28,1.42,0),(.52,1.1,0),'spine'); bone('forearm.R',(.52,1.1,0),(.48,.85,.04),'upper_arm.R')
bone('thigh.L',(-.16,.85,0),(-.18,.38,0),'root'); bone('shin.L',(-.18,.38,0),(-.18,0,0),'thigh.L')
bone('thigh.R',(.16,.85,0),(.18,.38,0),'root'); bone('shin.R',(.18,.38,0),(.18,0,0),'thigh.R'); bpy.ops.object.mode_set(mode='OBJECT')

def bone_parent(o,b):
    mw=o.matrix_world.copy(); o.parent=arm; o.parent_type='BONE'; o.parent_bone=b; o.matrix_world=mw
parts=[]
parts += [cube('torso',(0,1.27,0),(.34,.47,.19),shirt), cube('hem',(0,.82,0),(.40,.18,.22),shirt)]
parts += [uv('head',(0,1.92,.02),(.27,.30,.25),skin), uv('hair_cap',(0,2.03,-.10),(.29,.25,.23),hair), uv('bun',(0,2.25,-.18),(.17,.16,.16),hair)]
for x in (-.105,.105): parts += [uv('eye', (x,1.96,.255),(.035,.045,.018),dark), cube('brow',(x,2.055,.255),(.065,.012,.012),dark,.01)]
parts += [cyl('mouth',(0,1.84,.255),.045,.012,dark)]
for side,x in [('L',-.42),('R',.42)]:
    parts += [cyl('sleeve.'+side,(x,1.34,0),.11,.43,shirt), uv('palm.'+side,(x,1.02,.04),(.11,.11,.08),skin), cyl('thumb.'+side,(x+(-.05 if side=='L' else .05),1.08,.10),.035,.12,skin)]
for side,x in [('L',-.17),('R',.17)]: parts += [cyl('thigh.'+side,(x,.60,0),.13,.58,pants), cyl('shin.'+side,(x,.20,0),.115,.42,pants), cube('shoe.'+side,(x,.02,.08),(.14,.06,.24),pants,.03)]
def parent_bone_for(name):
    if any(k in name for k in ('torso','hem','sleeve','palm','thumb')): return 'spine'
    if name in ('head','hair_cap','bun','eye','brow','mouth'): return 'head'
    if any(k in name for k in ('thigh','shin','shoe')): return 'thigh.L' if '.L' in name else 'thigh.R'
    return 'upper_arm.L' if '.L' in name else 'upper_arm.R'
for o in parts: bone_parent(o,parent_bone_for(o.name))

# incense prop
for i,x in enumerate((-.055,0,.055)): bone_parent(cyl('incense.%d'%i,(x,1.55,.32),.014,.6,wood),'spine')

def pose(action_name, frames):
    a=bpy.data.actions.new(action_name); arm.animation_data_create(); arm.animation_data.action=a
    for f, rotations in frames:
        bpy.context.scene.frame_set(f)
        for name,rot in rotations.items():
            p=arm.pose.bones.get(name); p.rotation_mode='XYZ'; p.rotation_euler=rot; p.keyframe_insert('rotation_euler',frame=f)
    arm.animation_data.action=None; tr=arm.animation_data.nla_tracks.new(); tr.name=action_name; st=tr.strips.new(action_name,1,a); st.frame_start=1; st.frame_end=max(f for f,_ in frames); return a
pose('Idle',[(1,{}),(30,{'spine':(0,0,.015)}),(60,{'spine':(0,0,-.015)})])
pose('Walk',[(1,{'thigh.L':(.45,0,0),'thigh.R':(-.45,0,0),'upper_arm.L':(-.2,0,0),'upper_arm.R':(.2,0,0)}),(15,{'thigh.L':(-.45,0,0),'thigh.R':(.45,0,0),'upper_arm.L':(.2,0,0),'upper_arm.R':(-.2,0,0)}),(30,{'thigh.L':(.45,0,0),'thigh.R':(-.45,0,0),'upper_arm.L':(-.2,0,0),'upper_arm.R':(.2,0,0)})])
pose('Palms',[(1,{'upper_arm.L':(0,0,-.9),'upper_arm.R':(0,0,.9),'forearm.L':(0,0,-.25),'forearm.R':(0,0,.25)}),(30,{'upper_arm.L':(0,0,-.9),'upper_arm.R':(0,0,.9),'forearm.L':(0,0,-.25),'forearm.R':(0,0,.25)})])
pose('Incense',[(1,{'upper_arm.L':(0,0,-.6),'upper_arm.R':(0,0,.6),'forearm.L':(-.3,0,-.1),'forearm.R':(-.3,0,.1)}),(30,{'upper_arm.L':(0,0,-.6),'upper_arm.R':(0,0,.6),'forearm.L':(-.3,0,-.1),'forearm.R':(-.3,0,.1)})])
pose('Kneel',[(1,{'thigh.L':(.9,0,0),'thigh.R':(.9,0,0)}),(30,{'thigh.L':(.9,0,0),'thigh.R':(.9,0,0)})]); pose('Sit',[(1,{'thigh.L':(1.2,0,0),'thigh.R':(1.2,0,0),'shin.L':(-1.0,0,0),'shin.R':(-1.0,0,0)}),(30,{'thigh.L':(1.2,0,0),'thigh.R':(1.2,0,0),'shin.L':(-1.0,0,0),'shin.R':(-1.0,0,0)})])

# staging, camera, lights
cube('floor',(0,-.08,0),(4,.08,4),mat('floor_mat',(0.32,0.22,0.15)),.02); cube('backdrop',(0,2,-1.8),(4,2,.05),mat('wall_mat',(0.45,0.52,0.46)),.02)
bpy.ops.object.camera_add(location=(0,1.35,6.4)); cam=bpy.context.object; cam.data.lens=52; cam.rotation_euler=(Vector((0,1.1,0))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.rotation_euler.rotate_axis('Z',math.pi); bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA', location=(-3,5,4)); bpy.context.object.data.energy=700; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=4
bpy.ops.object.light_add(type='AREA', location=(3,3,2)); bpy.context.object.data.energy=250; bpy.context.object.data.size=3
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=393; sc.render.resolution_y=659; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.render.film_transparent=False
sc.world.color=(0.06,0.04,0.03)

def render(name, rot=0, action=None):
    bpy.context.scene.frame_set(1); arm.rotation_euler=(0,rot,0); cam.location=(0,1.35,6.4); cam.rotation_euler=(Vector((0,1.1,0))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.rotation_euler.rotate_axis('Z',math.pi)
    if action: arm.animation_data.action=bpy.data.actions.get(action)
    sc.render.filepath=os.path.join(OUT,name+'.png'); bpy.ops.render.render(write_still=True); arm.animation_data.action=None
for n,r,a in [('front',0,'Idle'),('three',math.radians(-25),'Idle'),('back',math.pi,'Idle'),('walk1',0,'Walk'),('walk2',0,'Walk'),('palms',0,'Palms'),('incense',0,'Incense'),('kneel',0,'Kneel'),('sit',0,'Sit')]: render(n,r,a)
# P30-like hall context: restrained altar, cushion, and faceless silhouette; no shared hall files changed.
cube('hall_altar',(0,1.15,-1.1),(1.55,.28,.38),wood,.05); cube('hall_table',(0,.62,-.72),(1.2,.12,.28),wood,.03); cyl('hall_buddha',(0,2.05,-1.28),.38,.18,mat('buddha_silhouette',(0.16,0.15,0.14))); cyl('hall_cushion',(-.9,.06,.1),.34,.08,mat('cushion',(0.52,0.40,0.22)))
render('hall-effect',0,'Idle')

blend=os.path.join(OUT,'character-anime.blend'); bpy.ops.wm.save_as_mainfile(filepath=blend)
glb=os.path.join(OUT,'character-anime.glb'); bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active=arm; bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB',export_animations=True,export_skins=True)
print('P42 Blender build complete',blend,glb)
