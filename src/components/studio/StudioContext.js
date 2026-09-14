import { createContext, useContext } from 'react';

export const StudioContext = createContext(null);
export const useStudio = () => useContext(StudioContext);
