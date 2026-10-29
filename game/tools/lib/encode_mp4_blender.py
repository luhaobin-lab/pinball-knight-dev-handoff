# Encodes a numbered PNG sequence into an H.264 MP4 (8-bit 4:2:0, libx264) with Blender's bundled
# FFmpeg, for machines whose ffmpeg has no H.264 encoder (Playwright's has only png and vp8).
#   blender -b --factory-startup --python encode_mp4_blender.py -- <frames dir> <fps> <out.mp4>
# Frames are taken in the numeric order of the last number in their names (f2 < f10 < f100) and must
# have even sizes. The sequencer runs with the Standard view transform, so sRGB values pass unchanged.
import os
import re
import struct
import sys

import bpy

frames_dir, fps, out = sys.argv[sys.argv.index('--') + 1:]


def frame_number(name):
    digits = re.findall(r'\d+', name)
    return (int(digits[-1]) if digits else -1, name)


files = sorted((f for f in os.listdir(frames_dir) if f.lower().endswith('.png')), key=frame_number)
if not files:
    raise SystemExit('encode_mp4_blender: no frames in ' + frames_dir)
with open(os.path.join(frames_dir, files[0]), 'rb') as fh:
    width, height = struct.unpack('>II', fh.read(24)[16:24])
if width % 2 or height % 2:
    raise SystemExit(f'encode_mp4_blender: H.264 4:2:0 needs even sizes, got {width}x{height}')

scene = bpy.context.scene
scene.render.resolution_x = width
scene.render.resolution_y = height
scene.render.resolution_percentage = 100
scene.render.fps = int(fps)
scene.render.fps_base = 1.0
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0
scene.sequencer_colorspace_settings.name = 'sRGB'

editor = scene.sequence_editor_create()
strips = editor.strips if hasattr(editor, 'strips') else editor.sequences
strip = strips.new_image(name='clip', filepath=os.path.join(frames_dir, files[0]), channel=1, frame_start=1)
for f in files[1:]:
    strip.elements.append(f)
strip.colorspace_settings.name = 'sRGB'
scene.frame_start = 1
scene.frame_end = len(files)

settings = scene.render.image_settings
if hasattr(settings, 'media_type'):
    settings.media_type = 'VIDEO'
settings.file_format = 'FFMPEG'
settings.color_mode = 'RGB'
if hasattr(settings, 'color_depth'):
    settings.color_depth = '8'
ff = scene.render.ffmpeg
ff.format = 'MPEG4'
ff.codec = 'H264'
ff.use_lossless_output = False
ff.constant_rate_factor = 'HIGH'
ff.ffmpeg_preset = 'GOOD'
ff.gopsize = int(fps)
ff.audio_codec = 'NONE'
scene.render.use_sequencer = True
scene.render.filepath = out
bpy.ops.render.render(animation=True)
print('encode_mp4_blender: wrote', out, len(files), 'frames', width, 'x', height)
