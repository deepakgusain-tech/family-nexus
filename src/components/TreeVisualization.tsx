import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { FamilyNode } from '@/types/family';

interface TreeVisualizationProps {
  data: FamilyNode;
  onNodeClick: (id: string, type: 'person' | 'spouse') => void;
  selectedId?: string | null;
}

interface LayoutNode {
  id: string;
  name: string;
  gender: string;
  birthYear?: number;
  x: number;
  y: number;
  type: 'person' | 'spouse';
  spouseType?: 'current' | 'ex';
  parentId?: string;
}

interface LayoutLink {
  source: { x: number; y: number };
  target: { x: number; y: number };
  type: 'current' | 'ex' | 'child';
}

const NODE_W = 160;
const NODE_H = 64;
const H_GAP = 40;
const V_GAP = 120;
const SPOUSE_GAP = 20;

function computeLayout(node: FamilyNode, x: number, y: number, nodes: LayoutNode[], links: LayoutLink[]): number {
  // Calculate total width needed for this family unit
  const spouseCount = node.spouses.length;
  const unitWidth = NODE_W + spouseCount * (NODE_W + SPOUSE_GAP);

  // Place the person node
  const currentWives = node.spouses.filter(s => s.type === 'current');
  const exWives = node.spouses.filter(s => s.type === 'ex');

  // Person center x
  const personX = x + currentWives.length * (NODE_W + SPOUSE_GAP);

  nodes.push({
    id: node.id,
    name: node.name,
    gender: node.gender,
    birthYear: node.birthYear,
    x: personX,
    y,
    type: 'person',
  });

  // Place current wives to the left
  currentWives.forEach((spouse, i) => {
    const sx = personX - (i + 1) * (NODE_W + SPOUSE_GAP);
    nodes.push({
      id: spouse.id,
      name: spouse.name,
      gender: spouse.gender,
      birthYear: spouse.birthYear,
      x: sx,
      y,
      type: 'spouse',
      spouseType: 'current',
      parentId: node.id,
    });
    links.push({
      source: { x: sx + NODE_W, y: y + NODE_H / 2 },
      target: { x: personX, y: y + NODE_H / 2 },
      type: 'current',
    });
  });

  // Place ex-wives to the right
  exWives.forEach((spouse, i) => {
    const sx = personX + NODE_W + SPOUSE_GAP + i * (NODE_W + SPOUSE_GAP);
    nodes.push({
      id: spouse.id,
      name: spouse.name,
      gender: spouse.gender,
      birthYear: spouse.birthYear,
      x: sx,
      y,
      type: 'spouse',
      spouseType: 'ex',
      parentId: node.id,
    });
    links.push({
      source: { x: personX + NODE_W, y: y + NODE_H / 2 },
      target: { x: sx, y: y + NODE_H / 2 },
      type: 'ex',
    });
  });

  // Layout children
  if (node.children.length === 0) return unitWidth;

  const childY = y + NODE_H + V_GAP;
  let childX = x;
  const childWidths: number[] = [];

  node.children.forEach(child => {
    const w = computeLayout(child, childX, childY, nodes, links);
    childWidths.push(w);
    childX += w + H_GAP;
  });

  const totalChildrenWidth = childWidths.reduce((a, b) => a + b, 0) + (node.children.length - 1) * H_GAP;

  // Center children under parent
  const parentCenterX = personX + NODE_W / 2;
  const childrenCenterX = x + totalChildrenWidth / 2;
  const offset = parentCenterX - childrenCenterX;

  if (offset !== 0) {
    // Shift all child nodes
    const shiftNodes = (n: FamilyNode) => {
      const found = nodes.filter(ln => ln.id === n.id || n.spouses.some(s => s.id === ln.id));
      found.forEach(ln => { ln.x += offset; });
      // Also shift links connected to these nodes
      n.children.forEach(shiftNodes);
    };
    node.children.forEach(shiftNodes);

    // Shift links too
    links.forEach(link => {
      // We'll just recompute links after all nodes are placed
    });
  }

  // Add parent-to-child links
  node.children.forEach(child => {
    const childNode = nodes.find(n => n.id === child.id)!;
    links.push({
      source: { x: parentCenterX, y: y + NODE_H },
      target: { x: childNode.x + NODE_W / 2, y: childY },
      type: 'child',
    });
  });

  return Math.max(unitWidth, totalChildrenWidth + (offset > 0 ? offset : 0));
}

const TreeVisualization: React.FC<TreeVisualizationProps> = ({ data, onNodeClick, selectedId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const renderTree = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const nodes: LayoutNode[] = [];
    const links: LayoutLink[] = [];
    computeLayout(data, 50, 50, nodes, links);

    // Recompute child links with actual node positions
    const childLinks = links.filter(l => l.type === 'child');
    childLinks.forEach(link => {
      const parentNode = nodes.find(n => n.x + NODE_W / 2 === link.source.x && n.y + NODE_H === link.source.y);
      const childNode = nodes.find(n => n.x + NODE_W / 2 === link.target.x);
      if (parentNode && childNode) {
        link.source = { x: parentNode.x + NODE_W / 2, y: parentNode.y + NODE_H };
        link.target = { x: childNode.x + NODE_W / 2, y: childNode.y };
      }
    });

    const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + 100;
    const maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + 100;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Center the tree initially
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const initialScale = Math.min(containerW / maxX, containerH / maxY, 1) * 0.9;
    const tx = (containerW - maxX * initialScale) / 2;
    const ty = 20;
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(initialScale));

    // Draw links
    const linkGroup = g.append('g').attr('class', 'links');

    links.forEach(link => {
      if (link.type === 'child') {
        const midY = (link.source.y + link.target.y) / 2;
        linkGroup.append('path')
          .attr('d', `M${link.source.x},${link.source.y} L${link.source.x},${midY} L${link.target.x},${midY} L${link.target.x},${link.target.y}`)
          .attr('fill', 'none')
          .attr('stroke', 'hsl(220, 15%, 30%)')
          .attr('stroke-width', 2);
      } else {
        linkGroup.append('line')
          .attr('x1', link.source.x)
          .attr('y1', link.source.y)
          .attr('x2', link.target.x)
          .attr('y2', link.target.y)
          .attr('stroke', link.type === 'current' ? 'hsl(38, 75%, 55%)' : 'hsl(0, 50%, 50%)')
          .attr('stroke-width', 2.5)
          .attr('stroke-dasharray', link.type === 'ex' ? '8,4' : 'none');
      }
    });

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');

    nodes.forEach(node => {
      const group = nodeGroup.append('g')
        .attr('transform', `translate(${node.x},${node.y})`)
        .attr('cursor', 'pointer')
        .on('click', () => onNodeClick(node.id, node.type));

      const isSelected = node.id === selectedId;

      // Node colors
      let fillColor = 'hsl(210, 60%, 50%)'; // male
      if (node.gender === 'female') fillColor = 'hsl(330, 60%, 55%)';
      if (node.spouseType === 'ex') fillColor = 'hsl(0, 40%, 40%)';

      // Shadow
      group.append('rect')
        .attr('x', 3)
        .attr('y', 3)
        .attr('width', NODE_W)
        .attr('height', NODE_H)
        .attr('rx', 10)
        .attr('fill', 'rgba(0,0,0,0.3)');

      // Main rect
      group.append('rect')
        .attr('width', NODE_W)
        .attr('height', NODE_H)
        .attr('rx', 10)
        .attr('fill', fillColor)
        .attr('stroke', isSelected ? 'hsl(38, 75%, 55%)' : 'hsl(220, 15%, 25%)')
        .attr('stroke-width', isSelected ? 3 : 1.5)
        .attr('opacity', 0.95);

      // Name text
      group.append('text')
        .attr('x', NODE_W / 2)
        .attr('y', NODE_H / 2 - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '13px')
        .attr('font-weight', '600')
        .attr('font-family', '"Space Grotesk", sans-serif')
        .text(node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name);

      // Subtitle
      const subtitle = node.spouseType
        ? node.spouseType === 'current' ? '💍 Wife' : '💔 Ex-Wife'
        : node.gender === 'male' ? '♂' : '♀';
      const yearText = node.birthYear ? ` • ${node.birthYear}` : '';

      group.append('text')
        .attr('x', NODE_W / 2)
        .attr('y', NODE_H / 2 + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.7)')
        .attr('font-size', '11px')
        .attr('font-family', 'system-ui')
        .text(subtitle + yearText);

      // Hover effect
      group.on('mouseenter', function () {
        d3.select(this).select('rect:nth-child(2)')
          .transition().duration(150)
          .attr('stroke', 'hsl(38, 75%, 55%)')
          .attr('stroke-width', 2.5);
      }).on('mouseleave', function () {
        if (!isSelected) {
          d3.select(this).select('rect:nth-child(2)')
            .transition().duration(150)
            .attr('stroke', 'hsl(220, 15%, 25%)')
            .attr('stroke-width', 1.5);
        }
      });
    });
  }, [data, onNodeClick, selectedId]);

  useEffect(() => {
    renderTree();
  }, [renderTree]);

  useEffect(() => {
    const handleResize = () => renderTree();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderTree]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-background rounded-lg border border-border">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
};

export default TreeVisualization;
