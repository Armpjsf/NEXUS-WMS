'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Info,
  Maximize2,
  Box,
  Flame,
  CheckCircle2,
  AlertTriangle,
  X,
  MapPin,
  TrendingUp,
  Settings2,
  Wand2,
  Plus,
  Trash2,
  Copy,
  Printer,
  Save,
  Sliders,
} from 'lucide-react';
import { RackConfig } from '@/app/api/warehouse/layout/route';

interface Warehouse3DProps {
  layout: {
    widthM: number;
    lengthM: number;
    heightM: number;
    racks: RackConfig[];
  };
  products?: any[];
  heatmapMode?: 'STOCK' | 'VELOCITY' | 'REALISTIC';
  selectedBinCode?: string | null;
  onSelectBin?: (binCode: string, binData?: any) => void;
  branchName?: string;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  onOpenWizard?: () => void;
  onOpenLabelModal?: () => void;
  onSaveLayout?: () => void;
  isSaving?: boolean;
  onUpdateLayout?: (newLayout: any) => void;
}

export default function Warehouse3DViewer({
  layout,
  products = [],
  heatmapMode = 'STOCK',
  selectedBinCode,
  onSelectBin,
  branchName = 'คลังหลัก',
  isEditMode = false,
  onToggleEditMode,
  onOpenWizard,
  onOpenLabelModal,
  onSaveLayout,
  isSaving = false,
  onUpdateLayout,
}: Warehouse3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredBin, setHoveredBin] = useState<string | null>(null);
  const [activeBinDetails, setActiveBinDetails] = useState<any | null>(null);
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalBins: 0, occupiedBins: 0, totalStock: 0 });

  // Map products to bins for fast lookup & visualization
  const binDataMap = useMemo(() => {
    const map = new Map<string, { products: any[]; totalStock: number; velocityClass: string }>();

    products.forEach(p => {
      const loc = (p.location || 'UNASSIGNED').trim().toUpperCase();
      if (!map.has(loc)) {
        map.set(loc, { products: [], totalStock: 0, velocityClass: p.velocityClass || 'B' });
      }
      const entry = map.get(loc)!;
      entry.products.push(p);
      entry.totalStock += Number(p.stock || 0);
    });

    return map;
  }, [products]);

  // Selected Rack object for inspector
  const selectedRack = useMemo(() => {
    if (!selectedRackCode) return null;
    return layout.racks.find(r => r.rackCode === selectedRackCode) || null;
  }, [selectedRackCode, layout.racks]);

  // Rack Mutation Handlers in Edit Mode
  const handleUpdateSelectedRack = (patch: Partial<RackConfig>) => {
    if (!selectedRack || !onUpdateLayout) return;
    const updatedRacks = layout.racks.map(r => {
      if (r.rackCode === selectedRack.rackCode) {
        return { ...r, ...patch };
      }
      return r;
    });
    onUpdateLayout({ ...layout, racks: updatedRacks });
  };

  const handleAddRack = () => {
    if (!onUpdateLayout) return;
    const nextIdx = layout.racks.length + 1;
    const newRackCode = `A-${String(nextIdx).padStart(2, '0')}-01`;
    const newRack: RackConfig = {
      rackCode: newRackCode,
      zoneCode: 'A',
      posX: 0,
      posZ: 0,
      rotationY: 0,
      bays: 5,
      levels: 4,
      bayWidth: 2.7,
      levelHeight: 1.8,
      rackDepth: 1.2,
      color: '#57ec7f',
      type: 'RACK',
    };
    onUpdateLayout({ ...layout, racks: [...layout.racks, newRack] });
    setSelectedRackCode(newRackCode);
  };

  const handleAddFloorBlock = (blockType: 'CROSS_DOCK' | 'FLOOR_BLOCK') => {
    if (!onUpdateLayout) return;
    const isXdock = blockType === 'CROSS_DOCK';
    const nextIdx = layout.racks.filter(r => r.type === blockType).length + 1;
    const newCode = isXdock ? `XDOCK-${String(nextIdx).padStart(2, '0')}` : `BULK-${String(nextIdx).padStart(2, '0')}`;
    const newBlock: RackConfig = {
      rackCode: newCode,
      zoneCode: isXdock ? 'XDOCK' : 'BULK',
      posX: isXdock ? 6 : -6,
      posZ: isXdock ? 15 : 0,
      rotationY: 0,
      bays: 4,
      levels: 1,
      bayWidth: 2.2,
      levelHeight: 1.2,
      rackDepth: 2.4,
      color: isXdock ? '#facc15' : '#4cd7f6',
      type: blockType,
    };
    onUpdateLayout({ ...layout, racks: [...layout.racks, newBlock] });
    setSelectedRackCode(newCode);
  };

  const handleDuplicateRack = (rack: RackConfig) => {
    if (!onUpdateLayout) return;
    const newRackCode = `${rack.rackCode}-COPY`;
    const duplicatedRack: RackConfig = {
      ...rack,
      rackCode: newRackCode,
      posX: rack.posX + (rack.rackDepth * 2 + 2.8), // Place across an aisle
    };
    onUpdateLayout({ ...layout, racks: [...layout.racks, duplicatedRack] });
    setSelectedRackCode(newRackCode);
  };

  const handleDeleteRack = (rackCode: string) => {
    if (!onUpdateLayout) return;
    const filtered = layout.racks.filter(r => r.rackCode !== rackCode);
    onUpdateLayout({ ...layout, racks: filtered });
    setSelectedRackCode(null);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- 1. Scene & Camera Setup ---
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090f15); // Tactical Dark Ground
    scene.fog = new THREE.FogExp2(0x090f15, 0.008);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500);
    camera.position.set(0, 45, 65);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.replaceChildren(renderer.domElement);

    // --- 2. Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x171c23, 0.6);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 60, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 150;
    const shadowDist = Math.max(layout.widthM, layout.lengthM) * 0.7;
    dirLight.shadow.camera.left = -shadowDist;
    dirLight.shadow.camera.right = shadowDist;
    dirLight.shadow.camera.top = shadowDist;
    dirLight.shadow.camera.bottom = -shadowDist;
    scene.add(dirLight);

    // --- 3. Concrete Floor & Grid ---
    const floorGeo = new THREE.PlaneGeometry(layout.widthM, layout.lengthM);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x12171e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(
      Math.max(layout.widthM, layout.lengthM),
      Math.max(layout.widthM, layout.lengthM) / 2,
      0x30353d,
      0x1b2027
    );
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Staging and Dock Areas (Painted floor marking)
    const stagingGeo = new THREE.PlaneGeometry(layout.widthM - 4, 8);
    const stagingMat = new THREE.MeshBasicMaterial({ color: 0x252a32, wireframe: true });
    const stagingMesh = new THREE.Mesh(stagingGeo, stagingMat);
    stagingMesh.rotation.x = -Math.PI / 2;
    stagingMesh.position.set(0, 0.02, layout.lengthM / 2 - 5);
    scene.add(stagingMesh);

    // Yellow Perimeter Border Line
    const aisleMarkerMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 });
    const aisleGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-layout.widthM / 2 + 2, 0.05, -layout.lengthM / 2 + 2),
      new THREE.Vector3(layout.widthM / 2 - 2, 0.05, -layout.lengthM / 2 + 2),
      new THREE.Vector3(layout.widthM / 2 - 2, 0.05, layout.lengthM / 2 - 2),
      new THREE.Vector3(-layout.widthM / 2 + 2, 0.05, layout.lengthM / 2 - 2),
      new THREE.Vector3(-layout.widthM / 2 + 2, 0.05, -layout.lengthM / 2 + 2),
    ]);
    const perimeterLine = new THREE.Line(aisleGeo, aisleMarkerMat);
    scene.add(perimeterLine);

    // --- 4. Procedural Racking Construction ---
    const binMeshes: THREE.Mesh[] = [];
    let countTotalBins = 0;
    let countOccupiedBins = 0;
    let countStock = 0;

    // Materials
    const steelPostMat = new THREE.MeshStandardMaterial({ color: 0x252a32, metalness: 0.8, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.4 });
    const selectedBeamMat = new THREE.MeshStandardMaterial({ color: 0x4cd7f6, metalness: 0.8, roughness: 0.2, emissive: 0x0ea5e9, emissiveIntensity: 0.3 });

    layout.racks.forEach((rack) => {
      const isThisRackSelected = isEditMode && selectedRackCode === rack.rackCode;
      const currentBeamMat = isThisRackSelected ? selectedBeamMat : beamMat;
      const isFloor = rack.type === 'CROSS_DOCK' || rack.type === 'FLOOR_BLOCK';

      const rackGroup = new THREE.Group();
      rackGroup.position.set(rack.posX, 0, rack.posZ);
      rackGroup.rotation.y = rack.rotationY;

      const totalRackLength = rack.bays * rack.bayWidth;
      const totalRackHeight = rack.levels * rack.levelHeight;

      if (isFloor) {
        // Floor Staging Boundary Pad
        const padGeo = new THREE.PlaneGeometry(totalRackLength, rack.rackDepth);
        const padMat = new THREE.MeshStandardMaterial({
          color: rack.type === 'CROSS_DOCK' ? 0x241d08 : 0x0f1c24,
          roughness: 0.9,
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.rotation.x = -Math.PI / 2;
        padMesh.position.set(0, 0.03, 0);
        padMesh.receiveShadow = true;
        rackGroup.add(padMesh);

        // Floor Border Lines (Yellow for Cross-dock, Cyan for Bulk)
        const borderMat = new THREE.LineBasicMaterial({
          color: isThisRackSelected ? 0x0ea5e9 : rack.type === 'CROSS_DOCK' ? 0xfacc15 : 0x4cd7f6,
          linewidth: 2,
        });
        const borderGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-totalRackLength / 2, 0.04, -rack.rackDepth / 2),
          new THREE.Vector3(totalRackLength / 2, 0.04, -rack.rackDepth / 2),
          new THREE.Vector3(totalRackLength / 2, 0.04, rack.rackDepth / 2),
          new THREE.Vector3(-totalRackLength / 2, 0.04, rack.rackDepth / 2),
          new THREE.Vector3(-totalRackLength / 2, 0.04, -rack.rackDepth / 2),
        ]);
        const borderLine = new THREE.Line(borderGeo, borderMat);
        rackGroup.add(borderLine);
      } else {
        // Vertical Uprights (Posts)
        const postGeo = new THREE.BoxGeometry(0.12, totalRackHeight + 0.5, 0.12);
        for (let b = 0; b <= rack.bays; b++) {
          const xPos = -totalRackLength / 2 + b * rack.bayWidth;
          // Front upright
          const postFront = new THREE.Mesh(postGeo, steelPostMat);
          postFront.position.set(xPos, totalRackHeight / 2, rack.rackDepth / 2);
          postFront.castShadow = true;
          rackGroup.add(postFront);

          // Back upright
          const postBack = new THREE.Mesh(postGeo, steelPostMat);
          postBack.position.set(xPos, totalRackHeight / 2, -rack.rackDepth / 2);
          postBack.castShadow = true;
          rackGroup.add(postBack);
        }
      }

      // Horizontal Beams & Individual Bins
      const beamGeo = new THREE.BoxGeometry(totalRackLength, 0.08, 0.08);

      for (let lvl = 1; lvl <= rack.levels; lvl++) {
        const yPos = isFloor ? (lvl * 1.1) : (lvl * rack.levelHeight);

        if (!isFloor) {
          // Front & Back Beams
          const beamFront = new THREE.Mesh(beamGeo, currentBeamMat);
          beamFront.position.set(0, yPos, rack.rackDepth / 2);
          rackGroup.add(beamFront);

          const beamBack = new THREE.Mesh(beamGeo, currentBeamMat);
          beamBack.position.set(0, yPos, -rack.rackDepth / 2);
          rackGroup.add(beamBack);

          // If non-pallet shelving, add a solid shelf decking board
          if (rack.palletMode === 'NON_PALLET') {
            const deckGeo = new THREE.BoxGeometry(totalRackLength, 0.02, rack.rackDepth);
            const deckMat = new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.8 });
            const deck = new THREE.Mesh(deckGeo, deckMat);
            deck.position.set(0, yPos - 0.04, 0);
            deck.receiveShadow = true;
            rackGroup.add(deck);
          }
        }

        // Individual Bins inside this level
        for (let bay = 1; bay <= rack.bays; bay++) {
          countTotalBins++;
          const xPos = -totalRackLength / 2 + (bay - 0.5) * rack.bayWidth;
          const binCode = `${rack.zoneCode}-${String(rack.rackCode).replace(/^[A-Z]-/, '')}-${String(bay).padStart(2, '0')}-${String(lvl).padStart(2, '0')}`.toUpperCase();

          const binData = binDataMap.get(binCode);
          const hasStock = !!(binData && binData.totalStock > 0);

          if (hasStock) {
            countOccupiedBins++;
            countStock += binData.totalStock;
          }

          // Bin Box Geometry
          const boxW = rack.bayWidth * 0.88;
          const boxH = isFloor ? 1.0 : (rack.levelHeight * 0.75);
          const boxD = rack.rackDepth * 0.88;

          const binBoxGeo = new THREE.BoxGeometry(boxW, boxH, boxD);

          // Color calculation based on heatmap mode
          let boxColor = isFloor ? (rack.type === 'CROSS_DOCK' ? 0x854d0e : 0x164e63) : 0x30353d;
          let boxOpacity = isFloor ? 0.4 : 0.25;

          if (isThisRackSelected) {
            boxColor = 0x0284c7; // Highlight selected rack in editor
            boxOpacity = 0.7;
          } else if (hasStock) {
            boxOpacity = 0.9;
            if (heatmapMode === 'STOCK') {
              boxColor = binData.totalStock > 80 ? 0xef4444 : binData.totalStock > 25 ? 0xfacc15 : 0x10b981;
            } else if (heatmapMode === 'VELOCITY') {
              boxColor = binData.velocityClass === 'A' ? 0x57ec7f : binData.velocityClass === 'B' ? 0x4cd7f6 : 0xfacc15;
            } else {
              boxColor = 0xd97706; // Wooden cardboard pallet
            }
          }

          const binBoxMat = new THREE.MeshStandardMaterial({
            color: boxColor,
            roughness: 0.6,
            metalness: 0.2,
            transparent: !hasStock && !isThisRackSelected,
            opacity: boxOpacity,
          });

          const binMesh = new THREE.Mesh(binBoxGeo, binBoxMat);
          binMesh.position.set(xPos, isFloor ? (boxH / 2 + 0.04) : (yPos - boxH / 2 + 0.05), 0);
          binMesh.castShadow = hasStock;
          binMesh.receiveShadow = true;

          // Attach metadata to mesh
          binMesh.userData = {
            binCode,
            rackCode: rack.rackCode,
            zone: rack.zoneCode,
            bay,
            level: lvl,
            hasStock,
            binData,
            rackType: rack.type || 'RACK',
            palletMode: rack.palletMode || 'PALLET',
          };

          rackGroup.add(binMesh);
          binMeshes.push(binMesh);
        }
      }

      scene.add(rackGroup);
    });

    setStats({
      totalBins: countTotalBins,
      occupiedBins: countOccupiedBins,
      totalStock: countStock,
    });

    // --- 5. Mouse Raycasting (Interaction) ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(binMeshes);

      if (intersects.length > 0) {
        const top = intersects[0].object as THREE.Mesh;
        const code = top.userData?.binCode;
        if (code) {
          setHoveredBin(code);
          container.style.cursor = 'pointer';
        }
      } else {
        setHoveredBin(null);
        container.style.cursor = 'grab';
      }
    };

    const handlePointerClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(binMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const data = hit.userData;
        if (isEditMode) {
          // In Edit Mode: Select Rack for Inspector
          if (data?.rackCode) {
            setSelectedRackCode(data.rackCode);
          }
        } else {
          // In Normal View: Open Bin Stock Drawer
          if (data?.binCode) {
            setActiveBinDetails(data);
            if (onSelectBin) onSelectBin(data.binCode, data.binData);
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handlePointerClick);

    // Simple Orbit / Pan Controls using Mouse Drag
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    let targetRotationX = 0.55;
    let targetRotationY = 0.75;
    let currentDistance = 75;

    const updateCameraPos = () => {
      camera.position.x = currentDistance * Math.sin(targetRotationY) * Math.cos(targetRotationX);
      camera.position.y = currentDistance * Math.sin(targetRotationX);
      camera.position.z = currentDistance * Math.cos(targetRotationY) * Math.cos(targetRotationX);
      camera.lookAt(0, 3, 0);
    };
    updateCameraPos();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetRotationY -= deltaX * 0.008;
      targetRotationX = Math.max(0.15, Math.min(Math.PI / 2.1, targetRotationX + deltaY * 0.008));
      updateCameraPos();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      currentDistance = Math.max(20, Math.min(180, currentDistance + e.deltaY * 0.05));
      updateCameraPos();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handlePointerClick);
      renderer.dispose();
    };
  }, [layout, heatmapMode, binDataMap, onSelectBin, isEditMode, selectedRackCode]);

  const occupancyRate = stats.totalBins > 0 ? Math.round((stats.occupiedBins / stats.totalBins) * 100) : 0;

  return (
    <div className="relative w-full h-[680px] bg-[#090f15] rounded-3xl overflow-hidden border border-[#30353d] shadow-2xl select-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Floating HUD: Telemetry & Branch Info */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="bg-[#171c23]/90 backdrop-blur-md border border-[#30353d] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#57ec7f] animate-pulse" />
          <div>
            <h4 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider">
              {branchName} • 3D DIGITAL TWIN {isEditMode && <span className="text-[#facc15] ml-1">[โหมดแก้ไข]</span>}
            </h4>
            <p className="text-[10px] text-[#8a92a6] font-mono">
              มิติ {layout.widthM}m × {layout.lengthM}m • แร็ก {layout.racks.length} แถว
            </p>
          </div>
        </div>

        {/* Live KPIs */}
        <div className="flex items-center gap-2">
          <div className="bg-[#171c23]/90 backdrop-blur-md border border-[#30353d] px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-[#8a92a6]">ความจุคลัง:</span>
            <span className="font-bold text-[#facc15]">{occupancyRate}%</span>
            <span className="text-[10px] text-[#8a92a6]">({stats.occupiedBins}/{stats.totalBins})</span>
          </div>

          <div className="bg-[#171c23]/90 backdrop-blur-md border border-[#30353d] px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2">
            <span className="text-[#8a92a6]">สต็อกรวม:</span>
            <span className="font-bold text-[#4cd7f6]">{stats.totalStock.toLocaleString()} ชิ้น</span>
          </div>
        </div>
      </div>

      {/* Top Right Floating Toolbar: Edit Mode & Actions */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {onToggleEditMode && (
          <button
            onClick={onToggleEditMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg ${
              isEditMode
                ? 'bg-[#facc15] text-[#1b1600] font-black shadow-[#facc15]/20 border border-[#facc15]'
                : 'bg-[#171c23]/90 text-[#dee2ec] border border-[#30353d] hover:border-slate-500'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {isEditMode ? 'เสร็จสิ้นการแก้ไข' : 'ปรับแต่งผังคลัง'}
          </button>
        )}

        {isEditMode && (
          <>
            {onOpenWizard && (
              <button
                onClick={onOpenWizard}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#facc15]/50 text-[#facc15] hover:bg-[#facc15]/10 transition-all flex items-center gap-1.5 shadow-lg"
              >
                <Wand2 className="w-3.5 h-3.5" /> Wizard คลังใหม่
              </button>
            )}

            <button
              onClick={handleAddRack}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#30353d] text-[#dee2ec] hover:border-slate-400 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-[#57ec7f]" /> เพิ่มแร็ก
            </button>

            <button
              onClick={() => handleAddFloorBlock('CROSS_DOCK')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#facc15]/40 text-[#facc15] hover:bg-[#facc15]/10 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-[#facc15]" /> ลาน Cross-Dock
            </button>

            <button
              onClick={() => handleAddFloorBlock('FLOOR_BLOCK')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#4cd7f6]/40 text-[#4cd7f6] hover:bg-[#4cd7f6]/10 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 text-[#4cd7f6]" /> ลานวางพื้น (Bulk)
            </button>

            {onOpenLabelModal && (
              <button
                onClick={onOpenLabelModal}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171c23]/90 border border-[#30353d] text-[#dee2ec] hover:border-slate-400 transition-all flex items-center gap-1.5 shadow-lg"
              >
                <Printer className="w-3.5 h-3.5 text-[#4cd7f6]" /> พิมพ์บาร์โค้ด
              </button>
            )}

            {onSaveLayout && (
              <button
                onClick={onSaveLayout}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-[#57ec7f] text-[#09150c] hover:bg-[#72f595] transition-all flex items-center gap-1.5 shadow-lg shadow-[#57ec7f]/20 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกผัง'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Hover Tooltip HUD */}
      {hoveredBin && !isEditMode && (
        <div className="absolute bottom-6 left-6 z-20 bg-[#171c23]/95 backdrop-blur-md border border-[#facc15]/50 px-4 py-2.5 rounded-2xl shadow-2xl pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#facc15]" />
            <span className="font-mono font-bold text-sm text-[#facc15]">{hoveredBin}</span>
            <span className="text-[10px] text-[#8a92a6] font-mono">คลิกเพื่อดูสินค้า</span>
          </div>
        </div>
      )}

      {/* Edit Mode: Rack Inspector Panel */}
      {isEditMode && selectedRack && (
        <div className="absolute top-16 right-4 bottom-4 w-80 z-30 bg-[#171c23]/95 backdrop-blur-md border border-[#30353d] rounded-2xl p-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right-4">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center justify-between border-b border-[#30353d] pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#facc15]" />
                <h3 className="font-mono font-bold text-sm text-[#dee2ec]">
                  แก้ไขแร็ก: {selectedRack.rackCode}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRackCode(null)}
                className="p-1 rounded-lg text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Properties Inputs */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">รหัสแร็ก (Rack Code)</label>
                <input
                  type="text"
                  value={selectedRack.rackCode}
                  onChange={e => handleUpdateSelectedRack({ rackCode: e.target.value })}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">ประเภทพื้นที่ (Storage Type)</label>
                <select
                  value={selectedRack.type || 'RACK'}
                  onChange={e => {
                    const newType = e.target.value as any;
                    const patch: Partial<RackConfig> = { type: newType };
                    if (newType !== 'RACK') {
                      patch.levels = 1;
                      patch.color = newType === 'CROSS_DOCK' ? '#facc15' : '#4cd7f6';
                    }
                    handleUpdateSelectedRack(patch);
                  }}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                >
                  <option value="RACK">ชั้นวางเหล็ก (Pallet Rack)</option>
                  <option value="CROSS_DOCK">ลานเปลี่ยนถ่าย (Cross-Dock Staging)</option>
                  <option value="FLOOR_BLOCK">ลานวางพื้นเทกอง (Floor Bulk Storage)</option>
                </select>
              </div>

              {selectedRack.type !== 'CROSS_DOCK' && selectedRack.type !== 'FLOOR_BLOCK' && (
                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">รูปแบบการวางสินค้า (Loading Mode)</label>
                  <select
                    value={selectedRack.palletMode || 'PALLET'}
                    onChange={e => {
                      const mode = e.target.value as any;
                      handleUpdateSelectedRack({
                        palletMode: mode,
                        rackDepth: mode === 'NON_PALLET' ? 0.8 : 1.2,
                        levelHeight: mode === 'NON_PALLET' ? 0.8 : 1.8,
                      });
                    }}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  >
                    <option value="PALLET">วางบนพาเลท (Palletized Racks)</option>
                    <option value="NON_PALLET">ไม่ออนพาเลท (กล่อง/ชิ้นสินค้า - Shelving)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">โซน (Zone)</label>
                  <select
                    value={selectedRack.zoneCode}
                    onChange={e => handleUpdateSelectedRack({ zoneCode: e.target.value })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  >
                    {['A', 'B', 'C', 'D'].map(z => (
                      <option key={z} value={z}>Zone {z}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">จำนวนชั้น (Levels)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={selectedRack.levels}
                    onChange={e => handleUpdateSelectedRack({ levels: Number(e.target.value) })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">ประเภทพื้นที่ (Storage Type)</label>
                <select
                  value={selectedRack.type || 'RACK'}
                  onChange={e => {
                    const newType = e.target.value as any;
                    const patch: Partial<RackConfig> = { type: newType };
                    if (newType !== 'RACK') {
                      patch.levels = 1;
                      patch.color = newType === 'CROSS_DOCK' ? '#facc15' : '#4cd7f6';
                    }
                    handleUpdateSelectedRack(patch);
                  }}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                >
                  <option value="RACK">ชั้นวางเหล็ก (Pallet Rack)</option>
                  <option value="CROSS_DOCK">ลานเปลี่ยนถ่าย (Cross-Dock Staging)</option>
                  <option value="FLOOR_BLOCK">ลานวางพื้นเทกอง (Floor Bulk Storage)</option>
                </select>
              </div>

              {selectedRack.type !== 'CROSS_DOCK' && selectedRack.type !== 'FLOOR_BLOCK' && (
                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">รูปแบบการวางสินค้า (Loading Mode)</label>
                  <select
                    value={selectedRack.palletMode || 'PALLET'}
                    onChange={e => {
                      const mode = e.target.value as any;
                      handleUpdateSelectedRack({
                        palletMode: mode,
                        rackDepth: mode === 'NON_PALLET' ? 0.8 : 1.2,
                        levelHeight: mode === 'NON_PALLET' ? 0.8 : 1.8,
                      });
                    }}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  >
                    <option value="PALLET">วางบนพาเลท (Palletized Racks)</option>
                    <option value="NON_PALLET">ไม่ออนพาเลท (กล่อง/ชิ้นสินค้า - Shelving)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">ช่วงเสา (Bays)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedRack.bays}
                    onChange={e => handleUpdateSelectedRack({ bays: Number(e.target.value) })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#8a92a6] block mb-1">ความสูงชั้น (m)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={1.0}
                    max={3.5}
                    value={selectedRack.levelHeight}
                    onChange={e => handleUpdateSelectedRack({ levelHeight: Number(e.target.value) })}
                    className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                  />
                </div>
              </div>

              {/* Coordinates X, Z */}
              <div className="bg-[#12161d] p-3 rounded-xl border border-[#30353d] space-y-2">
                <span className="text-[10px] font-mono text-[#8a92a6] block uppercase tracking-wider">
                  พิกัดตำแหน่ง (Coordinates)
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8a92a6]">แกน X (ซ้าย-ขวา):</span>
                  <input
                    type="number"
                    step={0.5}
                    value={selectedRack.posX}
                    onChange={e => handleUpdateSelectedRack({ posX: Number(e.target.value) })}
                    className="w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-right font-mono font-bold text-[#dee2ec]"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8a92a6]">แกน Z (หน้า-หลัง):</span>
                  <input
                    type="number"
                    step={0.5}
                    value={selectedRack.posZ}
                    onChange={e => handleUpdateSelectedRack({ posZ: Number(e.target.value) })}
                    className="w-20 bg-[#171c23] border border-[#30353d] rounded-lg px-2 py-1 text-right font-mono font-bold text-[#dee2ec]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-3 border-t border-[#30353d] space-y-2">
            <button
              onClick={() => handleDuplicateRack(selectedRack)}
              className="w-full py-2 rounded-xl bg-[#252a32] border border-[#30353d] text-xs font-bold text-[#dee2ec] hover:border-slate-400 transition-all flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-[#4cd7f6]" /> คัดลอกแถวแร็กคู่ขนาน (Duplicate)
            </button>
            <button
              onClick={() => handleDeleteRack(selectedRack.rackCode)}
              className="w-full py-2 rounded-xl bg-red-950/40 border border-red-800/50 text-xs font-bold text-red-400 hover:bg-red-900/50 transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> ลบแร็กแถวนี้
            </button>
          </div>
        </div>
      )}

      {/* Normal Mode: Selected Bin Side Drawer */}
      {!isEditMode && activeBinDetails && (
        <div className="absolute top-4 right-4 bottom-4 w-80 z-30 bg-[#171c23]/95 backdrop-blur-md border border-[#30353d] rounded-2xl p-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#30353d] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-[#facc15]" />
                <div>
                  <h3 className="font-mono font-bold text-base text-[#dee2ec]">
                    {activeBinDetails.binCode}
                  </h3>
                  <span className="text-[10px] font-mono text-[#8a92a6] flex items-center gap-1.5 mt-0.5">
                    <span>ช่องที่ {activeBinDetails.bay} • ชั้นที่ {activeBinDetails.level}</span>
                    {activeBinDetails.rackType === 'CROSS_DOCK' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#facc15]/20 text-[#facc15] font-bold text-[9px]">
                        CROSS-DOCK
                      </span>
                    )}
                    {activeBinDetails.rackType === 'FLOOR_BLOCK' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#4cd7f6]/20 text-[#4cd7f6] font-bold text-[9px]">
                        FLOOR BULK
                      </span>
                    )}
                    {activeBinDetails.palletMode === 'NON_PALLET' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#4cd7f6]/20 text-[#4cd7f6] font-bold text-[9px]">
                        NON-PALLET (วางกล่อง)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveBinDetails(null)}
                className="p-1 rounded-lg text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Details */}
            {activeBinDetails.hasStock ? (
              <div className="space-y-3">
                <div className="bg-[#12161d] p-3 rounded-xl border border-[#30353d]">
                  <span className="text-[10px] font-mono text-[#8a92a6] block mb-1">สต็อกคงเหลือรวม</span>
                  <div className="text-2xl font-black text-[#57ec7f] font-mono">
                    {activeBinDetails.binData?.totalStock || 0}{' '}
                    <span className="text-xs text-[#8a92a6] font-normal">ชิ้น</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  <span className="text-[11px] font-mono text-[#8a92a6] uppercase tracking-wider block">
                    รายการสินค้าในช่องนี้
                  </span>
                  {(activeBinDetails.binData?.products || []).map((p: any, idx: number) => (
                    <div
                      key={p.id || idx}
                      className="p-2.5 rounded-lg bg-[#1b2027] border border-[#30353d] text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#dee2ec] line-clamp-1">{p.name}</div>
                        <div className="text-[10px] font-mono text-[#8a92a6]">SKU: {p.sku || p.id}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#facc15] font-mono">{p.stock}</span>
                        <span className="text-[10px] text-[#8a92a6] ml-1">{p.unit || 'ชิ้น'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-[#8a92a6] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#57ec7f] mx-auto opacity-70" />
                <p className="text-xs font-mono">ช่องนี้ว่าง พร้อมสำหรับจัดเก็บ (Available)</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#30353d] text-[10px] text-[#8a92a6] font-mono text-center">
            หมุนภาพ: คลิกซ้ายลาก • ซูม: สกอร์ลเมาส์
          </div>
        </div>
      )}

      {/* Bottom Right Controls Help */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-[#171c23]/80 backdrop-blur-md border border-[#30353d] px-3 py-1.5 rounded-xl text-[11px] font-mono text-[#8a92a6] pointer-events-none">
        <RotateCcw className="w-3.5 h-3.5 text-[#facc15]" />
        <span>3D Orbit Controls Active</span>
      </div>
    </div>
  );
}
