export type Gender = 'male' | 'female';
export type SpouseType = 'current' | 'ex';

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthYear?: number;
}

export interface Spouse {
  id: string;
  name: string;
  gender: Gender;
  type: SpouseType;
  birthYear?: number;
}

export interface FamilyNode {
  id: string;
  name: string;
  gender: Gender;
  birthYear?: number;
  spouses: Spouse[];
  children: FamilyNode[];
}

export interface FamilyTreeData {
  root: FamilyNode | null;
}
