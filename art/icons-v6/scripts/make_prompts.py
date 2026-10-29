from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def make(b):
 slot=b['slot'];shape='square' if not slot or slot['rows']==2 else ('landscape 2:1' if slot['rows']==1 else 'portrait 2:3')
 subject=f"{b['name']} ({b['id']}). Visual motif: {b['legacyArt']['motif']}."
 meaning=f"Gameplay meaning for selecting the image metaphor only: {b['description']}."
 return f'''Use case: stylized-concept.
Asset type: ONE isolated dark-fantasy game {'talent' if not slot else 'inventory item'} icon, transparent high-resolution mother painting, to be pixelized afterward.
Input images: Image 1 is an approved icon used ONLY for its hand-inked drawing, paint and material language. Images 2 and 3 are official Pass the Fear style-reference crops used ONLY for contour, shapes and cel shadows. Do not copy their depicted subjects, UI, symbols, border, or text.
Primary subject: {subject}
{meaning}
Create a distinct, expressive design for THIS named subject. Preserve its understandable identity and use a single dominant gesture or structural idea. {'Depict the talent as a compact narrative emblem or tangible gesture, with meaningful negative space; it is not equipment and does not need an enclosing shield or badge.' if not slot else 'Build a complete tangible object, with clear joining parts and a recognizable functional silhouette.'} Do not mechanically add an eye, skull, rib cage, or thorn ring to every subject. Use the stated motif as the primary composition; use distortion only when it supports its meaning.
Style: a sophisticated 2D hand-inked illustration with expressive black outlines, controlled variation in line thickness, tapered internal seams, slightly imperfect corners and individually drawn joints. Strong designed color masses, one bold painted shadow family and sparse drawn highlights per material. Occasional selective hatching, generous calm untextured areas, readable layering and carefully shaped gaps. Dark, eerie, inventive and tactile, with the same level of finish as the approved example.
Palette: charcoal ink, chalky dirty ivory, muted ochre/brass, desaturated carmine/plum; choose a restrained teal/blue/green accent only where the subject requires it. Do not make every object the same red-and-bone design. Local colors must help identify this particular subject.
Composition: {shape} canvas; complete centered silhouette, minimum 8% clean transparent margin, fills the usable area. {'For this very wide canvas, compose the object horizontally or diagonally so it reads naturally without shrinking to a tiny vertical object.' if slot and slot['rows']==1 else ''} Large designed components must remain readable at 256 pixels wide. One asset only. Actual alpha transparency, no cast shadow outside the object, no floor or background.
Avoid: photoreal anatomy, PBR or 3D render, wet/glossy specular coating, noisy micro-textures, decorative scratches everywhere, geometric vector perfection, filter bevels, artificial pixel grid, UI card, text, letters, watermark, multiple alternatives or contact sheet. This is the source painting, not yet pixel art.'''
if __name__=='__main__':
 briefs=json.loads((ROOT/'data/briefs.json').read_text())
 for b in briefs:
  if b['id'] not in ['I005','I047','I106']:(ROOT/'prompts'/f"{b['id']}.txt").write_text(make(b))
 print('Wrote 305 individualized prompts.')
