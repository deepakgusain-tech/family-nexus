import { useState, useCallback } from 'react';
import { FamilyNode, Spouse, Gender, SpouseType } from '@/types/family';

const SAMPLE_DATA: FamilyNode = {
  id: '1',
  name: 'Robert Smith',
  gender: 'male',
  birthYear: 1955,
  spouses: [
    { id: '2', name: 'Mary Smith', gender: 'female', type: 'current', birthYear: 1958 },
    { id: '3', name: 'Jane Doe', gender: 'female', type: 'ex', birthYear: 1960 },
  ],
  children: [
    {
      id: '4',
      name: 'James Smith',
      gender: 'male',
      birthYear: 1980,
      spouses: [
        { id: '5', name: 'Sarah Smith', gender: 'female', type: 'current', birthYear: 1982 },
      ],
      children: [
        { id: '8', name: 'Emma Smith', gender: 'female', birthYear: 2010, spouses: [], children: [] },
      ],
    },
    {
      id: '6',
      name: 'Lisa Smith',
      gender: 'female',
      birthYear: 1983,
      spouses: [],
      children: [],
    },
    {
      id: '7',
      name: 'Tom Doe',
      gender: 'male',
      birthYear: 1985,
      spouses: [],
      children: [],
    },
  ],
};

let nextId = 100;
const genId = () => String(++nextId);

export function useFamilyTree() {
  const [root, setRoot] = useState<FamilyNode>(SAMPLE_DATA);

  const findNode = useCallback((node: FamilyNode, id: string): FamilyNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }, []);

  const updateTree = useCallback((node: FamilyNode, id: string, updater: (n: FamilyNode) => FamilyNode): FamilyNode => {
    if (node.id === id) return updater(node);
    return {
      ...node,
      children: node.children.map(c => updateTree(c, id, updater)),
    };
  }, []);

  const addChild = useCallback((parentId: string, name: string, gender: Gender, birthYear?: number) => {
    setRoot(prev => updateTree(prev, parentId, node => ({
      ...node,
      children: [...node.children, { id: genId(), name, gender, birthYear, spouses: [], children: [] }],
    })));
  }, [updateTree]);

  const addSpouse = useCallback((personId: string, name: string, gender: Gender, type: SpouseType, birthYear?: number) => {
    setRoot(prev => updateTree(prev, personId, node => ({
      ...node,
      spouses: [...node.spouses, { id: genId(), name, gender, type, birthYear }],
    })));
  }, [updateTree]);

  const updatePerson = useCallback((id: string, updates: { name?: string; gender?: Gender; birthYear?: number }) => {
    setRoot(prev => {
      // Check if it's a main node
      const updated = updateTree(prev, id, node => ({ ...node, ...updates }));
      // Also check spouses
      const updateSpouses = (node: FamilyNode): FamilyNode => ({
        ...node,
        spouses: node.spouses.map(s => s.id === id ? { ...s, ...updates } : s),
        children: node.children.map(updateSpouses),
      });
      return updateSpouses(updated);
    });
  }, [updateTree]);

  const updateSpouseType = useCallback((personId: string, spouseId: string, newType: SpouseType) => {
    setRoot(prev => updateTree(prev, personId, node => ({
      ...node,
      spouses: node.spouses.map(s => s.id === spouseId ? { ...s, type: newType } : s),
    })));
  }, [updateTree]);

  const deletePerson = useCallback((id: string) => {
    setRoot(prev => {
      if (prev.id === id) return prev; // Can't delete root
      const removeFromTree = (node: FamilyNode): FamilyNode => ({
        ...node,
        spouses: node.spouses.filter(s => s.id !== id),
        children: node.children.filter(c => c.id !== id).map(removeFromTree),
      });
      return removeFromTree(prev);
    });
  }, []);

  const exportData = useCallback(() => JSON.stringify(root, null, 2), [root]);

  const importData = useCallback((json: string) => {
    try {
      const data = JSON.parse(json) as FamilyNode;
      setRoot(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { root, findNode: (id: string) => findNode(root, id), addChild, addSpouse, updatePerson, updateSpouseType, deletePerson, exportData, importData };
}
