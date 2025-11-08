import { useState } from "react";
import { FiX, FiCopy } from "react-icons/fi";

export default function RoomModal({
  isOpen,
  onClose,
  roomId,
  onCreateRoom,
  onJoinRoom,
}) {
  const [inputRoomId, setInputRoomId] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Room Options</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <button
              onClick={onCreateRoom}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
            >
              Create New Room
            </button>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-300 mb-2">Join existing room:</p>
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                placeholder="Enter room ID"
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded"
              />
              <button
                onClick={() => {
                  onJoinRoom(inputRoomId);
                  onClose();
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
              >
                Join
              </button>
            </div>
          </div>

          {roomId && (
            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 mb-2">Current room:</p>
              <div className="flex items-center bg-gray-700 rounded p-2">
                <code className="flex-1 text-white">{roomId}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                  }}
                  className="text-gray-400 hover:text-white ml-2"
                  title="Copy room ID"
                >
                  <FiCopy />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
