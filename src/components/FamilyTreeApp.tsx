import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Upload, TreePine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TreeVisualization from '@/components/TreeVisualization';
import { AddPersonModal, EditPersonModal } from '@/components/FamilyModals';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { toast } from 'sonner';

const FamilyTreeApp: React.FC = () => {
  const { root, findNode, addChild, addSpouse, updatePerson, updateSpouseType, deletePerson, exportData, importData } = useFamilyTree();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'person' | 'spouse'>('person');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNodeClick = useCallback((id: string, type: 'person' | 'spouse') => {
    setSelectedId(id);
    setSelectedType(type);
    setEditModal(true);
  }, []);

  const getSelectedData = () => {
    if (!selectedId) return null;
    // Check main nodes
    const node = findNode(selectedId);
    if (node) return { name: node.name, gender: node.gender, birthYear: node.birthYear, isSpouse: false };
    // Check spouses
    const findSpouse = (n: typeof root): { spouse: any; parentId: string } | null => {
      for (const s of n.spouses) {
        if (s.id === selectedId) return { spouse: s, parentId: n.id };
      }
      for (const c of n.children) {
        const found = findSpouse(c);
        if (found) return found;
      }
      return null;
    };
    const spouseResult = findSpouse(root);
    if (spouseResult) {
      return {
        name: spouseResult.spouse.name,
        gender: spouseResult.spouse.gender,
        birthYear: spouseResult.spouse.birthYear,
        isSpouse: true,
        spouseType: spouseResult.spouse.type,
        parentId: spouseResult.parentId,
      };
    }
    return null;
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-tree.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Family tree exported!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = importData(ev.target?.result as string);
      if (result) toast.success('Family tree imported!');
      else toast.error('Invalid file format');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Find a parent node to add to (default to selected or root)
  const addParentId = selectedId && findNode(selectedId) ? selectedId : root.id;
  const addParentName = findNode(addParentId)?.name || root.name;

  const selectedData = selectedId ? getSelectedData() : null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur-sm z-10"
      >
        <div className="flex items-center gap-3">
          <TreePine className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-xl font-bold text-foreground">Family Tree</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddModal(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Add Member
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
            <Upload className="w-4 h-4" /> Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </motion.header>

      {/* Legend */}
      <div className="flex items-center gap-6 px-6 py-2 text-xs text-muted-foreground border-b border-border bg-card/50">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(210, 60%, 50%)' }} /> Male
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(330, 60%, 55%)' }} /> Female
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-0.5" style={{ background: 'hsl(38, 75%, 55%)' }} /> Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: 'hsl(0, 50%, 50%)' }} /> Ex
        </span>
        <span className="text-muted-foreground/60 ml-auto">Scroll to zoom • Drag to pan • Click node to edit</span>
      </div>

      {/* Tree */}
      <div className="flex-1">
        <TreeVisualization data={root} onNodeClick={handleNodeClick} selectedId={selectedId} />
      </div>

      {/* Add Modal */}
      <AddPersonModal
        open={addModal}
        onClose={() => setAddModal(false)}
        parentName={addParentName}
        onAdd={({ name, gender, birthYear, mode, spouseType }) => {
          if (mode === 'child') {
            addChild(addParentId, name, gender, birthYear);
          } else if (mode === 'spouse' && spouseType) {
            addSpouse(addParentId, name, gender, spouseType, birthYear);
          }
          toast.success(`${name} added to the family tree!`);
        }}
      />

      {/* Edit Modal */}
      {selectedData && (
        <EditPersonModal
          open={editModal}
          onClose={() => { setEditModal(false); setSelectedId(null); }}
          initialData={{ name: selectedData.name, gender: selectedData.gender, birthYear: selectedData.birthYear }}
          isSpouse={selectedData.isSpouse}
          spouseType={selectedData.isSpouse ? selectedData.spouseType : undefined}
          onSave={(data) => {
            updatePerson(selectedId!, data);
            toast.success('Person updated!');
          }}
          onDelete={() => {
            deletePerson(selectedId!);
            toast.success('Person removed from tree');
            setSelectedId(null);
          }}
          onSpouseTypeChange={(type) => {
            if (selectedData.isSpouse && selectedData.parentId) {
              updateSpouseType(selectedData.parentId, selectedId!, type);
            }
          }}
        />
      )}
    </div>
  );
};

export default FamilyTreeApp;
