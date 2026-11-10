import { createContext, useContext } from 'react';

export interface RouterContextType {
  currentPath: string;
  targetPath: string | null;
  navigate: (path: string) => void;
  isNavigating: boolean;
}

export const RouterContext = createContext<RouterContextType>({
  currentPath: '/',
  targetPath: null,
  navigate: () => {},
  isNavigating: false,
});

export const useRouter = () => useContext(RouterContext);

