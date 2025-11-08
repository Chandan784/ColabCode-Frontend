import { useState } from "react";
import { FiCode, FiPlay, FiLogIn, FiLogOut, FiUsers } from "react-icons/fi";
import RoomModal from "../RoomModal/RoomModal";

export default function Navbar({
  user,
  isRunning,
  isConnected,
  activeUsersCount,
  onRunCode,
  onLogin,
  onLogout,
  onCreateRoom,
  onJoinRoom,
  roomId,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold flex items-center">
            <FiCode className="mr-2" /> CodeCollab
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded"
              >
                <FiUsers className="mr-2" />
                {roomId ? "Room" : "Create Room"}
              </button>

              <button
                onClick={onRunCode}
                disabled={isRunning}
                className={`px-3 py-1 rounded flex items-center ${
                  isRunning ? "bg-gray-600" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                <FiPlay className="mr-2" />
                {isRunning ? "Running..." : "Run Code"}
              </button>
            </>
          )}

          <div className="flex items-center space-x-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></span>
            <span>
              {activeUsersCount} user{activeUsersCount !== 1 ? "s" : ""}
            </span>
          </div>

          {user ? (
            <button
              onClick={onLogout}
              className="flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
            >
              <FiLogOut className="mr-2" />
              Logout
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
            >
              <FiLogIn className="mr-2" />
              Login
            </button>
          )}
        </div>
      </div>

      <RoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        roomId={roomId}
        onCreateRoom={() => {
          onCreateRoom();
          setIsModalOpen(false);
        }}
        onJoinRoom={onJoinRoom}
      />
    </>
  );
}
