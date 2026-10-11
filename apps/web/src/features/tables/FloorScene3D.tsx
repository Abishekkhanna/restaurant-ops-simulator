import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChefHat, ConciergeBell, Droplets, Minus, MousePointer2, Plus, RotateCcw, Utensils } from 'lucide-react';
import type { DiningTable, Employee, PickupTask, PrepTask, WashTask } from '../../types';

type Props = {
  tables: DiningTable[]; employees: Employee[]; tasks: PrepTask[]; pickups: PickupTask[]; washTasks: WashTask[];
  selectedTableId?: string | null; onSelectTable: (id: string) => void;
};
type StaffActor = { employee: Employee; root: THREE.Group; arms: THREE.Group[]; home: THREE.Vector3; target: THREE.Vector3; phase: number };

const TABLE_SPOTS = [new THREE.Vector3(-5.2, 0, -2.2), new THREE.Vector3(-1.8, 0, -2.7), new THREE.Vector3(2.0, 0, -2.4), new THREE.Vector3(5.2, 0, -1.4), new THREE.Vector3(-3.9, 0, 2.4), new THREE.Vector3(-.2, 0, 2.2), new THREE.Vector3(3.7, 0, 2.8)];
const POINTS = { kitchen: new THREE.Vector3(-7, 0, -4.4), pass: new THREE.Vector3(0, 0, -5.1), wash: new THREE.Vector3(7, 0, -3.9), host: new THREE.Vector3(0, 0, 5.3) };

function material(color: THREE.ColorRepresentation, roughness = .78) { return new THREE.MeshStandardMaterial({ color, roughness, metalness: .02 }); }
function box(parent: THREE.Object3D, size: [number, number, number], color: THREE.ColorRepresentation, at: [number, number, number], cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color)); mesh.position.set(...at); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent: THREE.Object3D, rt: number, rb: number, height: number, color: THREE.ColorRepresentation, at: [number, number, number], segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, height, segments), material(color)); mesh.position.set(...at); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function makeTable(scene: THREE.Scene, table: DiningTable, index: number, selected: boolean, onSelect: (table: DiningTable) => void) {
  const group = new THREE.Group(); const spot = TABLE_SPOTS[index % TABLE_SPOTS.length]!; group.position.copy(spot); group.userData.tableId = table.id;
  const color = table.status === 'AVAILABLE' ? '#64805b' : table.status === 'CLEANING' ? '#52879a' : table.status === 'RESERVED' ? '#d09a3b' : '#b9573e';
  // Chairs, pedestal, tabletop, banana leaf and brass thali are assembled as scene objects.
  cylinder(group, .22, .3, .48, '#755443', [0, .35, 0]);
  const top = box(group, [1.8, .18, 1.25], selected ? '#a94e36' : '#956849', [0, .68, 0]);
  top.material = material(selected ? '#a94e36' : color);
  box(group, [1.05, .025, .56], '#86a66c', [0, .79, 0]);
  cylinder(group, .2, .2, .025, '#c49a4a', [0, .82, 0], 24);
  cylinder(group, .12, .12, .03, '#d9c79c', [0, .85, 0], 24);
  for (const [x, z] of [[-1.15, 0], [1.15, 0], [0, -.9], [0, .9]] as const) {
    box(group, [.48, .18, .48], '#694c3c', [x, .14, z]);
    box(group, [.45, .1, .44], '#8b6850', [x, .25, z]);
  }
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.24, 48), new THREE.MeshBasicMaterial({ color: selected ? '#dfab45' : color, transparent: true, opacity: selected ? .9 : .34, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = .89; group.add(halo);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(8, 8, 240, 80, 18); ctx.fill(); ctx.fillStyle = '#382c24'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(table.tableNo, 128, 44); ctx.font = 'bold 19px sans-serif'; ctx.fillStyle = color; ctx.fillText(table.status.replaceAll('_', ' '), 128, 70);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); label.scale.set(1.55, .58, 1); label.position.set(0, 1.72, 0); group.add(label);
  group.traverse((object) => { if (object instanceof THREE.Mesh) object.userData.tableId = table.id; });
  group.userData.select = () => onSelect(table); scene.add(group); return group;
}
function makeStaff(scene: THREE.Scene, employee: Employee, start: THREE.Vector3, end: THREE.Vector3, index: number): StaffActor {
  const root = new THREE.Group(); root.position.copy(start); root.userData.employeeId = employee.id;
  const tunic = employee.role === 'COOK' ? '#efe4ce' : employee.role === 'DISHWASHER' ? '#527e84' : employee.role === 'MANAGER' ? '#684043' : '#527258';
  cylinder(root, .18, .23, .72, tunic, [0, .87, 0], 8);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), material('#bd8764')); head.position.set(0, 1.38, 0); head.castShadow = true; root.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.205, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), material('#382c27')); hair.position.set(0, 1.45, 0); root.add(hair);
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .2, 1.13, 0); const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .48, 8), material(tunic)); sleeve.position.y = -.2; sleeve.rotation.z = side * -.12; sleeve.castShadow = true; arm.add(sleeve); root.add(arm); arms.push(arm);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .42, 8), material('#413b35')); leg.position.set(side * .12, .2, 0); leg.castShadow = true; root.add(leg);
  }
  const badgeCanvas = document.createElement('canvas'); badgeCanvas.width = 256; badgeCanvas.height = 64;
  const ctx = badgeCanvas.getContext('2d')!; ctx.fillStyle = '#fffdf8'; ctx.beginPath(); ctx.roundRect(4, 4, 248, 56, 14); ctx.fill(); ctx.fillStyle = '#302920'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(employee.name.split(' ')[0], 128, 39);
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(badgeCanvas), transparent: true, depthTest: false })); badge.scale.set(1.15, .29, 1); badge.position.set(0, 1.85, 0); root.add(badge);
  scene.add(root);
  return { employee, root, arms, home: start.clone(), target: end.clone(), phase: index * 1.7 };
}

function addArchitecture(scene: THREE.Scene) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(19, 14), material('#dec8a6')); floor.rotation.x = -Math.PI / 2; floor.position.y = -.04; floor.receiveShadow = true; scene.add(floor);
  const tile = new THREE.GridHelper(19, 19, '#c8ad87', '#c8ad87'); tile.position.y = -.025; (tile.material as THREE.Material).transparent = true; (tile.material as THREE.Material).opacity = .13; scene.add(tile);
  box(scene, [19, .3, .45], '#805a43', [0, 0, -7.1]); box(scene, [.45, 3, 14], '#f4e6ce', [-9.25, 1.5, 0]); box(scene, [19, 3, .45], '#ead7b9', [0, 1.5, -7.1]);
  // Open front and one side keep the room visible as an architectural cutaway.
  const altar = new THREE.Group(); altar.position.set(0, 0, -5.8); scene.add(altar);
  box(altar, [4.6, .75, 1.25], '#67493a', [0, .4, 0]); box(altar, [4.8, .12, 1.38], '#95704e', [0, .83, 0]);
  for (let i = 0; i < 3; i++) { cylinder(altar, .34, .34, .04, '#c3943d', [-1.35 + i * 1.35, .92, 0]); cylinder(altar, .17, .17, .11, '#e1b85b', [-1.35 + i * 1.35, 1, 0]); }
  const kitchen = new THREE.Group(); kitchen.position.set(-7.4, 0, -4.7); scene.add(kitchen);
  box(kitchen, [2.2, .8, 2.7], '#6b4a38', [0, .45, 0]); box(kitchen, [2.35, .12, 2.85], '#8d7055', [0, .91, 0]);
  for (let i = 0; i < 2; i++) { cylinder(kitchen, .38, .38, .06, '#47535b', [-.5 + i, 1, -.45], 24); cylinder(kitchen, .27, .27, .06, '#bf633f', [-.5 + i, 1.08, -.45], 24); }
  box(scene, [2.5, .8, 1.25], '#70939a', [7.3, .4, -4.8]); box(scene, [2.7, .12, 1.4], '#c5d4d1', [7.3, .86, -4.8]);
  for (const x of [6.55, 7.3, 8.05]) cylinder(scene, .16, .16, .2, '#d3dad4', [x, 1, -4.8]);
  box(scene, [1.6, .75, 1.05], '#956a48', [8, .38, 4.9]); box(scene, [1.75, .1, 1.2], '#c29b68', [8, .8, 4.9]);
  box(scene, [2.2, .1, .18], '#9c704d', [-8, .65, 3.3]);
  for (let i = 0; i < 4; i++) box(scene, [.18, .13, .18], '#b68b54', [-8.7 + i * .47, .79, 3.3]);
  // Brass hanging lamps add a small local architectural cue above dining tables.
  for (const x of [-5, 0, 5]) { cylinder(scene, .025, .025, 1.3, '#a28352', [x, 2.75, -1]); const lamp = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), material('#e2b453')); lamp.scale.y = .45; lamp.position.set(x, 2.05, -1); scene.add(lamp); }
}

export function FloorScene3D({ tables, employees, tasks, pickups, washTasks, selectedTableId, onSelectTable }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const selectTableRef = useRef(onSelectTable); selectTableRef.current = onSelectTable;
  const cameraActionsRef = useRef<{ zoom: (delta: number) => void; reset: () => void } | null>(null);
  const [webglError, setWebglError] = useState(false);
  const selectionRef = useRef(selectedTableId); selectionRef.current = selectedTableId;
  useEffect(() => {
    const element = mount.current; if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch { setWebglError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = 'restaurant-webgl-canvas'; element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e8e5df'); scene.fog = new THREE.Fog('#e8e5df', 22, 42);
    const camera = new THREE.PerspectiveCamera(37, 1, .1, 100); camera.position.set(15.8, 18.3, 21.8); camera.lookAt(0, .1, 0);
    const homeCamera = camera.position.clone();
    cameraActionsRef.current = {
      zoom: (delta) => { camera.fov = THREE.MathUtils.clamp(camera.fov + delta, 28, 52); camera.updateProjectionMatrix(); },
      reset: () => { camera.position.copy(homeCamera); camera.fov = 37; camera.lookAt(0, .1, 0); camera.updateProjectionMatrix(); },
    };
    scene.add(new THREE.HemisphereLight('#fff9e9', '#7e756a', 2.0));
    const sun = new THREE.DirectionalLight('#fff0d1', 3.1); sun.position.set(-8, 17, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -15; sun.shadow.camera.right = 15; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14; scene.add(sun);
    addArchitecture(scene);
    const clickable: THREE.Object3D[] = [];
    const tableRoots = tables.map((table, index) => { const root = makeTable(scene, table, index, table.id === selectedTableId, (picked) => selectTableRef.current(picked.id)); clickable.push(root); return root; });
    const actorSpecs = employees.filter((person) => person.status !== 'OFF_DUTY').map((person) => {
      const roleIndex = employees.filter((candidate) => candidate.role === person.role && candidate.status !== 'OFF_DUTY').findIndex((candidate) => candidate.id === person.id);
      let start: THREE.Vector3; let end: THREE.Vector3;
      if (person.role === 'COOK') { const task = tasks.find((item) => item.cook?.id === person.id && ['ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK'].includes(item.status)); start = new THREE.Vector3(-7.4 + (roleIndex % 2) * .55, 0, -2.8 + Math.floor(roleIndex / 2) * .55); end = task ? POINTS.kitchen.clone().add(new THREE.Vector3((roleIndex % 2) * .48, 0, Math.floor(roleIndex / 2) * .35)) : POINTS.kitchen.clone().add(new THREE.Vector3((roleIndex % 2) * .48, 0, 1 + Math.floor(roleIndex / 2) * .35)); }
      else if (person.role === 'DISHWASHER') { const wash = washTasks.find((item) => item.employee?.id === person.id && ['IN_PROGRESS', 'SANITIZING'].includes(item.status)); start = new THREE.Vector3(6.2 + roleIndex * .35, 0, -3.3 + roleIndex * .5); end = wash ? POINTS.wash.clone().add(new THREE.Vector3(roleIndex * .4, 0, 0)) : POINTS.wash.clone().add(new THREE.Vector3(roleIndex * .4, 0, 1)); }
      else if (person.role === 'SERVER') {
        const pickup = pickups.find((item) => item.serverId === person.id && ['ASSIGNED', 'IN_PROGRESS'].includes(item.status));
        const tableNo = pickup?.item.order.session.table.tableNo;
        const tableIndex = tableNo ? tables.findIndex((table) => table.tableNo === tableNo) : tables.findIndex((table) => table.currentSession?.server?.id === person.id);
        const home = POINTS.host.clone().add(new THREE.Vector3((roleIndex - 2) * .78, 0, 0));
        const tablePosition = tableIndex >= 0 ? TABLE_SPOTS[tableIndex % TABLE_SPOTS.length]!.clone().add(new THREE.Vector3(.9, 0, .75)) : home;
        start = pickup?.status === 'IN_PROGRESS' ? POINTS.pass.clone().add(new THREE.Vector3(.9, 0, roleIndex * .18)) : pickup && tableIndex >= 0 ? tablePosition : home;
        end = pickup?.status === 'IN_PROGRESS' && tableIndex >= 0 ? tablePosition : pickup ? POINTS.pass.clone().add(new THREE.Vector3(.9, 0, roleIndex * .18)) : tableIndex >= 0 ? tablePosition : home;
      } else { start = POINTS.host.clone().add(new THREE.Vector3(0, 0, -1)); end = POINTS.host; }
      return { person, start, end };
    });
    const actors = actorSpecs.map((spec, index) => makeStaff(scene, spec.person, spec.start, spec.end, index));
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let dragStart: { x: number; y: number; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => { dragStart = { x: event.clientX, y: event.clientY, moved: false }; renderer.domElement.setPointerCapture(event.pointerId); };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragStart) return;
      const dx = event.clientX - dragStart.x; const dy = event.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragStart.moved = true;
      if (!dragStart.moved) return;
      const offset = camera.position.clone(); offset.y += dy * .035; offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx * .006); camera.position.copy(offset); camera.position.y = THREE.MathUtils.clamp(camera.position.y, 10, 27); camera.lookAt(0, 0, 0); dragStart.x = event.clientX; dragStart.y = event.clientY;
    };
    const onPointerCancel = () => { dragStart = null; };
    const onPointer = (event: PointerEvent) => {
      if (dragStart?.moved) { dragStart = null; return; }
      dragStart = null;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera); const target = raycaster.intersectObjects(clickable, true).find((hit) => hit.object.userData.tableId);
      const tableId = target?.object.userData.tableId as string | undefined; if (tableId) selectTableRef.current(tableId);
    };
    const onWheel = (event: WheelEvent) => { event.preventDefault(); camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * .018, 28, 52); camera.updateProjectionMatrix(); };
    renderer.domElement.addEventListener('pointerdown', onPointerDown); renderer.domElement.addEventListener('pointermove', onPointerMove); renderer.domElement.addEventListener('pointerup', onPointer); renderer.domElement.addEventListener('pointercancel', onPointerCancel); renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    let animation = 0; const clock = new THREE.Clock();
    const resize = () => { if (!element.clientWidth || !element.clientHeight) return; camera.aspect = element.clientWidth / element.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(element.clientWidth, element.clientHeight, false); };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(element); resize();
    const render = () => {
      animation = requestAnimationFrame(render); const elapsed = clock.getElapsedTime();
      for (const actor of actors) {
        const goal = actor.employee.role === 'COOK' || actor.employee.role === 'DISHWASHER' ? actor.target : actor.target;
        actor.root.position.lerp(goal, .018); const distance = actor.root.position.distanceTo(goal); const moving = distance > .13;
        actor.root.rotation.y = moving ? Math.atan2(goal.x - actor.root.position.x, goal.z - actor.root.position.z) : actor.root.rotation.y;
        actor.root.position.y = moving ? Math.abs(Math.sin(elapsed * 9 + actor.phase)) * .08 : Math.sin(elapsed * 2 + actor.phase) * .018;
        actor.arms.forEach((arm, i) => { arm.rotation.x = moving ? Math.sin(elapsed * 9 + actor.phase + i * Math.PI) * .55 : actor.employee.role === 'COOK' ? Math.sin(elapsed * 5 + actor.phase) * .24 : Math.sin(elapsed * 2 + actor.phase) * .05; });
      }
      tableRoots.forEach((root, index) => { if (tables[index]?.id === selectionRef.current) root.scale.setScalar(1.045); else root.scale.setScalar(1); });
      renderer.render(scene, camera);
    };
    render();
    return () => { cameraActionsRef.current = null; cancelAnimationFrame(animation); resizeObserver.disconnect(); renderer.domElement.removeEventListener('pointerdown', onPointerDown); renderer.domElement.removeEventListener('pointermove', onPointerMove); renderer.domElement.removeEventListener('pointerup', onPointer); renderer.domElement.removeEventListener('pointercancel', onPointerCancel); renderer.domElement.removeEventListener('wheel', onWheel); scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) { object.geometry?.dispose(); const mat = object.material; (Array.isArray(mat) ? mat : [mat]).forEach((entry) => { if ('map' in entry && entry.map) entry.map.dispose(); entry.dispose(); }); } }); renderer.dispose(); renderer.domElement.remove(); };
  }, [tables, employees, tasks, pickups, washTasks]);

  return <section className="simulation-panel" aria-label="Live three-dimensional restaurant simulation">
    <div className="simulation-canvas" ref={mount} aria-label="3D restaurant floor. Select tables using the table controls below." />
    <div className="simulation-topbar"><div><span className="simulation-brand"><Utensils size={15} /> மதுரை மண்வாசனை</span><span className="simulation-subtitle">MADURAI DINING ROOM · LIVE OPERATIONS</span></div><div className="simulation-live"><i /> Live restaurant state</div></div>
    <div className="simulation-quickstats"><div><span>Tables</span><b>{tables.filter((table) => table.status === 'AVAILABLE').length} <small>available</small></b></div><div><span>Kitchen</span><b>{tasks.filter((task) => ['QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK'].includes(task.status)).length} <small>active tasks</small></b></div><div><span>Pickup</span><b>{pickups.filter((task) => task.status === 'ASSIGNED').length} <small>ready</small></b></div><div><span>Team</span><b>{employees.filter((person) => person.status !== 'OFF_DUTY').length} <small>on shift</small></b></div></div>
    {webglError && <div className="simulation-fallback"><b>3D rendering is unavailable in this browser.</b><span>Use the table controls below to continue service.</span></div>}
    <div className="simulation-location-tags"><span><ChefHat size={14} /> Kitchen</span><span><Utensils size={14} /> Food pass</span><span><Droplets size={14} /> Dishwashing</span><span><ConciergeBell size={14} /> Host station</span></div>
    <div className="simulation-controls-hint"><MousePointer2 size={13} /> Drag to rotate · scroll to zoom · select table <span className="simulation-camera-buttons"><button onClick={() => cameraActionsRef.current?.zoom(-4)} aria-label="Zoom in"><Plus size={13} /></button><button onClick={() => cameraActionsRef.current?.zoom(4)} aria-label="Zoom out"><Minus size={13} /></button><button onClick={() => cameraActionsRef.current?.reset()} aria-label="Reset camera"><RotateCcw size={13} /></button></span></div>
  </section>;
}
