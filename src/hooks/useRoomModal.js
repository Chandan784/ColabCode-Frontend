import { useState } from "react";

export const useRoomModal = () => {
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");

  const openRoomModal = () => setShowRoomModal(true);
  const closeRoomModal = () => {
    setShowRoomModal(false);
    setJoinRoomId("");
  };

  return {
    showRoomModal,
    joinRoomId,
    setJoinRoomId,
    openRoomModal,
    closeRoomModal,
  };
};
