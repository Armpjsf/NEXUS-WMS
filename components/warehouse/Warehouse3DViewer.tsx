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
}

export default function Warehouse3DViewer({
  layout,
  products = [],
  heatmapMode = 'STOCK',
  selectedBinCode,
  onSelectBin,
  branchName = 'คลังหลัก',
}: Warehouse3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredBin, setHoveredBin] = useState<string | null>(null);
  const [activeBinDetails, setActiveBinDetails] = useState<any | null>(null);
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
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);

    // Subtle Industrial Yellow Ceiling Spotlights
    const spotLight = new THREE.PointLight(0xfacc15, 1.5, 80);
    spotLight.position.set(0, 25, 0);
    scene.add(spotLight);

    // --- 3. Warehouse Floor & Grid ---
    const floorGeo = new THREE.PlaneGeometry(layout.widthM, layout.lengthM);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x12161d,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Grid lines
    const gridHelper = new THREE.GridHelper(Math.max(layout.widthM, layout.lengthM), 40, 0x30353d, 0x1b2027);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // Yellow Floor Walkway Boundaries
    const aisleMarkerMat = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.4 });
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
    const emptyPalletMat = new THREE.MeshStandardMaterial({ color: 0x30353d, transparent: true, opacity: 0.25 });

    layout.racks.forEach((rack) => {
      const rackGroup = new THREE.Group();
      rackGroup.position.set(rack.posX, 0, rack.posZ);
      rackGroup.rotation.y = rack.rotationY;

      const totalRackLength = rack.bays * rack.bayWidth;
      const totalRackHeight = rack.levels * rack.levelHeight;

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

      // Horizontal Beams & Individual Bins
      const beamGeo = new THREE.BoxGeometry(totalRackLength, 0.08, 0.08);

      for (let lvl = 1; lvl <= rack.levels; lvl++) {
        const yPos = lvl * rack.levelHeight;

        // Front & Back Beams
        const beamFront = new THREE.Mesh(beamGeo, beamMat);
        beamFront.position.set(0, yPos, rack.rackDepth / 2);
        rackGroup.add(beamFront);

        const beamBack = new THREE.Mesh(beamGeo, beamMat);
        beamBack.position.set(0, yPos, -rack.rackDepth / 2);
        rackGroup.add(beamBack);

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
          const boxH = rack.levelHeight * 0.75;
          const boxD = rack.rackDepth * 0.88;

          const binBoxGeo = new THREE.BoxGeometry(boxW, boxH, boxD);

          // Color calculation based on heatmap mode
          let boxColor = 0x30353d;
          let boxOpacity = 0.25;

          if (hasStock) {
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
            transparent: !hasStock,
            opacity: boxOpacity,
          });

          const binMesh = new THREE.Mesh(binBoxGeo, binBoxMat);
          binMesh.position.set(xPos, yPos - boxH / 2 + 0.05, 0);
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
        if (data?.binCode) {
          setActiveBinDetails(data);
          if (onSelectBin) onSelectBin(data.binCode, data.binData);
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handlePointerClick);

    // Simple Orbit / Pan Controls using Mouse Drag
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let spherical = { radius: 75, theta: Math.PI / 4, phi: Math.PI / 3.2 };

    const updateCameraPosition = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 5, 0);
    };

    updateCameraPosition();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseMoveOrbit = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      spherical.theta -= deltaX * 0.008;
      spherical.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, spherical.phi - deltaY * 0.008));
      updateCameraPosition();
    };

    const onWheelZoom = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(15, Math.min(160, spherical.radius + e.deltaY * 0.06));
      updateCameraPosition();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMoveOrbit);
    renderer.domElement.addEventListener('wheel', onWheelZoom, { passive: false });

    // --- 6. Animation Loop ---
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
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
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handlePointerClick);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMoveOrbit);
      renderer.domElement.removeEventListener('wheel', onWheelZoom);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [layout, binDataMap, heatmapMode, onSelectBin]);

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
              {branchName} • 3D DIGITAL TWIN
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

      {/* Hover Tooltip HUD */}
      {hoveredBin && (
        <div className="absolute bottom-6 left-6 z-20 bg-[#171c23]/95 backdrop-blur-md border border-[#facc15]/50 px-4 py-2.5 rounded-2xl shadow-2xl pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#facc15]" />
            <span className="font-mono font-bold text-sm text-[#facc15]">{hoveredBin}</span>
            <span className="text-[10px] text-[#8a92a6] font-mono">คลิกเพื่อดูสินค้า</span>
          </div>
        </div>
      )}

      {/* Selected Bin Side Drawer */}
      {activeBinDetails && (
        <div className="absolute top-4 right-4 bottom-4 w-80 z-30 bg-[#171c23]/95 backdrop-blur-md border border-[#30353d] rounded-2xl p-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#30353d] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-[#facc15]" />
                <div>
                  <h3 className="font-mono font-bold text-base text-[#dee2ec]">
                    {activeBinDetails.binCode}
                  </h3>
                  <span className="text-[10px] font-mono text-[#8a92a6]">
                    ช่องที่ {activeBinDetails.bay} • ชั้นที่ {activeBinDetails.level}
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
