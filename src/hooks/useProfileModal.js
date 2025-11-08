import { useState } from "react";

export const useProfileModal = () => {
  const [showProfileModal, setShowProfileModal] = useState(false);

  const openProfileModal = () => setShowProfileModal(true);
  const closeProfileModal = () => setShowProfileModal(false);

  return {
    showProfileModal,
    openProfileModal,
    closeProfileModal,
  };
};
