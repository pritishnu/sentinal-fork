import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function HeroCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 60;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Particle field
    const particleCount = isMobile ? 600 : 1500;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorA = new THREE.Color('#7C3AED');
    const colorB = new THREE.Color('#06B6D4');

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radius = 20 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const mixed = colorA.clone().lerp(colorB, Math.random());
      colors[i3] = mixed.r;
      colors[i3 + 1] = mixed.g;
      colors[i3 + 2] = mixed.b;

      sizes[i] = Math.random() * 2 + 0.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Central wireframe icosahedron
    const icoGeo = new THREE.IcosahedronGeometry(12, 1);
    const icoMat = new THREE.MeshBasicMaterial({
      color: '#7C3AED',
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    scene.add(ico);

    // Inner smaller icosahedron
    const icoGeo2 = new THREE.IcosahedronGeometry(7, 0);
    const icoMat2 = new THREE.MeshBasicMaterial({
      color: '#06B6D4',
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const ico2 = new THREE.Mesh(icoGeo2, icoMat2);
    scene.add(ico2);

    // Mouse reactivity
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetRotX = (e.clientY / window.innerHeight - 0.5) * 0.3;
      targetRotY = (e.clientX / window.innerWidth - 0.5) * 0.3;
    };
    window.addEventListener('mousemove', onMouseMove);

    let animationId: number;

    const animate = () => {
      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      if (!reduceMotion) {
        points.rotation.y += 0.0008;
        points.rotation.x += 0.0003;
        ico.rotation.y += 0.002;
        ico.rotation.x += 0.001;
        ico2.rotation.y -= 0.003;
        ico2.rotation.z += 0.002;
      }

      scene.rotation.x = currentRotX;
      scene.rotation.y = currentRotY;

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      icoGeo.dispose();
      icoMat.dispose();
      icoGeo2.dispose();
      icoMat2.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
