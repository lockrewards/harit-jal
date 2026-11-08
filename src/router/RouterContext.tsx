import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface RouterContextType {
  currentPath: string;
  targetPath: string | null;
  navigate: (path: string) => void;
  isNavigating: boolean;
}

const RouterContext = createContext<RouterContextType>({
  currentPath: '/',
  targetPath: null,
  navigate: () => {},
  isNavigating: false,
});

export const useRouter = () => useContext(RouterContext);

interface RouterProviderProps {
  children: ReactNode;
}

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname || '/';
      setTargetPath(nextPath);
      setIsNavigating(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const timer = setTimeout(() => {
        setCurrentPath(nextPath);
        setTargetPath(null);
        setIsNavigating(false);
      }, 240);
      return () => clearTimeout(timer);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (path !== currentPath) {
      setTargetPath(path);
      setIsNavigating(true);
      window.history.pushState({}, '', path);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setTimeout(() => {
        setCurrentPath(path);
        setTargetPath(null);
        setIsNavigating(false);
      }, 260);
    }
  };

  return (
    <RouterContext.Provider value={{ currentPath, targetPath, navigate, isNavigating }}>
      {children}
    </RouterContext.Provider>
  );
};

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
  className?: string;
}

export const Link: React.FC<LinkProps> = ({ to, children, className, onClick, ...rest }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClick) onClick(e);
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
};

