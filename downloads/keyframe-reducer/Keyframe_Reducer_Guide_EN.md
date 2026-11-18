# Keyframe Reducer 1.1.1

Free Blender 5.2 add-on, developed and tested in **Blender 5.2.1 LTS**.
Inspired by working with Cinema 4D's Key Reducer. It does not reproduce its
algorithm or its Magnet feature.

The plugin interface is in **English**, including buttons, options, tooltips and
messages. [Guide français](Keyframe_Reducer_Guide_FR.md).

## Installation

1. Download **keyframe_reducer-1.1.1.zip** from the [tool page](https://killianpichon.art/technical/keyframe-reducer/).
2. In Blender, open **Edit > Preferences > Add-ons > top-right menu > Install from Disk**.
3. Select **keyframe_reducer-1.1.1.zip**. Do not extract this ZIP.
4. Enable **Keyframe Reducer** if necessary.
5. In the 3D View or Graph Editor, press **N** and open **Key Reducer**.

Requires Blender 5.2.0 or later. No dependencies, network access, account or special
permissions are required.

To update version 1.0.0 or 1.1.0, install the new ZIP in the same location and allow
replacement. Save your project and restart Blender if the old interface remains.

## Fix in 1.1.1: consistent modules after an update

Version 1.1.0 could show `Settings.__init__() got an unexpected keyword argument
'key_selection'` when installed over version 1.0.0 in the same Blender session.
The interface was updated, but the old Python engine remained in memory.
Version **1.1.1 refreshes the components in dependency order** during an update.
The panel title now displays its version.

If you are still using version 1.1.0, saving your scene and fully closing and
reopening Blender also clears the old engine. This issue is unrelated to which
keys you select.

## New: reduce selected keys only

1. In the **Graph Editor**, display the channels you want to edit and select the
   **key points**, for example using **B** for Box Select.
2. Open **N > Key Reducer** and choose **Scope: Selected Keys**.
3. Adjust **Strength**, then click **Reduce on a Copy**.
4. Compare **Original / Reduced**. **Recalculate from Source** reuses the captured
   selection even if your visible selection has changed in the meantime.
5. To process another section, display **Reduced**, select its keys and click
   **Reduce New Selection**. This uses the displayed Action as the new source,
   preserving the reductions already visible in that Action.
6. Click **Keep Copy for Editing** before making manual corrections.

Each run of at least **three consecutive selected keys** is processed separately.
An unselected key breaks the run: you can select several sections without reducing
the motion between them. The first and last keys of every run are retained.
Isolated keys and selections containing only two keys are left unchanged.

- Unselected keys keep their values, handles, types and selection flags. The
  inward handles of selected boundary keys may change; their outward handles are
  preserved to retain motion outside the selected section.
- Channels hidden or filtered out of the Graph Editor, and locked channels, are
  excluded when capturing the selection. Select key points, not just handles.
- For location, scale and Euler rotation, only axes with selected keys participate.
  If several axes participate, their runs need selected keys at matching times.
  A missing or unselected key breaks the common run.
- For **quaternion rotation**, select **W, X, Y and Z together** at the same times.
  Partial quaternion selections are preserved and reported in the panel.
- An empty selection displays an error; it never triggers a whole-Action reduction.
  Custom properties are still excluded from reduction.
- Capture the initial or a new selection from the Graph Editor in **F-Curves** mode.
  Once captured, it can also be recalculated from the 3D View. The Dope Sheet is not
  used to capture the selection.

The captured selection and comparison are saved in the .blend file. Changing
Scope starts a new comparison from the currently displayed Action.

## General workflow

1. Select the armature and its **active Action**, with the correct slot.
2. For a complete NLA sequence, first use **Strip > Bake Action** in the NLA Editor
   with Visual Keying enabled, Pose, and no overwrite of the current Action. Then
   disable the original NLA tracks. The add-on reduces an Action, not the NLA stack.
3. Choose **Scope: Entire Action**, adjust **Strength**, then **Reduce on a Copy**.
4. Play the animation and switch between **Original / Reduced** to compare.
5. Adjust Strength or the tolerances and click **Recalculate from Source**.
   Recalculation starts from the source without accumulating reductions.
6. Click **Keep Copy for Editing**, then fix keys in the Graph Editor.

The original and reduced Actions are retained when saving the .blend file. The
add-on does not save files for you; save your project normally. Comparison remains
available after saving and reopening when the add-on is enabled.
Manual edits made to the preview before **Keep Copy for Editing** will be replaced
by the next recalculation. Finish comparison before editing keys.

## Settings

| Option | Effect |
|---|---|
| Strength | Multiplies tolerances. 0.5 retains more detail; 1 is the default; 2 allows twice the error. |
| Smooth Bezier | Rebuilds Auto Clamped handles, preserves endpoint velocity and validates Blender's actual evaluated curves. |
| Linear | Uses linear interpolation, useful for mocap imports and sometimes more efficient. |
| Position | Maximum vector error in **local units**, before armature scale. The test rig has scale 0.01, so 0.1 local unit corresponds to about 0.001 world unit for a direct translation. |
| Rotation | Quaternion angular error; vector error of unwrapped Euler angles to retain complete turns. Default: 0.5 degrees. |
| Scale | Vector error of scale factors. Default: 0.001. |
| Selected Bones Only | Processes selected bones in Pose Mode. Other bones and object transforms remain unchanged. |
| Keep Significant Extremes | Protects meaningful direction changes in location, scale and Euler channels. Quaternion orientation is protected by angular tolerance. |
| Protect Extreme / Breakdown Keys | Retains times marked with these key types. Useful for protecting a specific pose. |
| Validate Every 0.25 Frame | Finer sampling; the default checks every 0.5 frame. Original key times are always checked too. |

In **Entire Action** mode, keys are aligned **per property**: XYZ location, XYZ
scale, XYZ Euler or WXYZ quaternion. The add-on does not force all bones or
properties to share the same pose times, and does not shift keys like C4D Magnet.

## Protection and limitations

- The source is copied. Other slots in the Action remain unchanged.
- Custom properties, including Mixamo's `lockInfluenceWeights`, are preserved.
- Locked, muted or modified channels preserve their transform group. Constant or
  special interpolation also prevents reduction of the affected group or run.
- Incomplete quaternions and quaternion sign discontinuities are preserved.
- In Entire Action mode, groups with different channel start/end times are
  preserved. Selected Keys mode only processes common selected runs.
- If reconstruction cannot meet the tolerance, the original group or run is restored.
- Group boundaries and protected marked keys are retained. Output uses existing
  key times; no additional fractional key times are introduced.
- **Validation uses samples of local transforms**. It is not a continuous guarantee
  at every instant or a world-space foot contact constraint. Small rotation errors
  can accumulate along a bone chain. IK or contact key corrections may still be needed.
- Reduction does not automatically remove mocap jitter or capture errors.
- Only the active Action is processed. Exit NLA Tweak Mode before use.

## Source code and license

The installation ZIP includes the complete Python source and Blender manifest.
Licensed under **GPL-3.0-or-later**; see LICENSE. No Maxon code is used.
This release is not affiliated with Maxon or the Blender Foundation.
