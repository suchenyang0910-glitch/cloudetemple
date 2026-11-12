# Town 3D places

[已验证事实] Each place lives in its own directory and exports the same four functions:

```js
enter({ world, temple })
leave({ world, temple })
update({ world, temple, delta, now })
resources() // returns the place's asset URL list
```

[已验证事实] The town calls `enter` when the visitor reaches that place's door, `leave` when they leave its trigger, and `update` once per frame while it is active. `world` is the existing town world object; both `resources()` implementations currently return an empty array.

[假设] A future place should dispose of anything it adds when `leave` runs.

[已验证事实] Reusable town behavior is in `shared.js`: `stepWalking({ visitor, keys, pointer, target, delta, canOccupy })`, `updateFollowCamera({ world, delta, reduced, mapMode, cameraOffset, mapPosition, mapTarget })`, `updateBillboards(billboards, camera, mapMode)`, and `updateLabels({ world, temples, labelDivs, mapMode })`.

[用户决定] `hall/` belongs to Codex D and `petgarden/` belongs to Codex E. Shared files and the other place directory are outside each place owner's scope; submit shared-file changes through the queue. `ccgs/town-3d` remains the read-only P0 baseline.

[假设] The existing Chùa Mây town trigger is the hall entry and is registered to `hall`; the pet garden has no town trigger yet and is registered under its own key until its entry is specified.
