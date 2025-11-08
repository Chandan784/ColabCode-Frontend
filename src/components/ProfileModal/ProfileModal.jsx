import { FiLogOut } from "react-icons/fi";

const ProfileModal = ({ user, onClose, onLogout }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xs overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              &times;
            </button>
          </div>

          <div className="flex flex-col items-center mb-4">
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-16 h-16 rounded-full border-2 border-indigo-500 mb-2"
            />
            <h3 className="text-lg font-medium text-gray-800">
              {user.displayName}
            </h3>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            <FiLogOut className="mr-2" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
