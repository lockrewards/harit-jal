import React from 'react';
import { NeerWidget } from './neer/NeerWidget';

interface MascotNeerProps {
  onOpenBookingModal?: () => void;
}

export const MascotNeer: React.FC<MascotNeerProps> = ({ onOpenBookingModal }) => {
  return <NeerWidget onOpenBookingModal={onOpenBookingModal} />;
};

export default MascotNeer;
