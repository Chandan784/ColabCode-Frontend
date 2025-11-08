import { FiCopy } from "react-icons/fi";

const UserList = ({ users, roomId, onCopyRoomLink }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="bg-indigo-600 text-white p-3 flex justify-between items-center">
        <h3 className="font-medium flex items-center">
          Active Users ({users?.length || 0})
        </h3>
        {roomId && (
          <button
            onClick={onCopyRoomLink}
            className="text-xs bg-indigo-700 hover:bg-indigo-800 p-1 rounded transition-colors"
            title="Copy room link"
          >
            <FiCopy size={14} />
          </button>
        )}
      </div>
      <div className="flex-grow p-3 overflow-y-auto">
        {users?.length > 0 ? (
          <ul className="space-y-3">
            {users.map((user) => (
              <li key={user.uid} className="flex items-center space-x-3 py-1">
                <img
                  src={user.photoURL}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2"
                  style={{
                    borderColor: user.isTyping
                      ? getRandomColor(user.uid)
                      : "transparent",
                  }}
                />
                <div className="min-w-0">
                  <p className="text-gray-800 truncate font-medium">
                    {user.name}
                  </p>
                  {user.isTyping && (
                    <p className="text-xs text-yellow-600 animate-pulse">
                      Typing...
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-4">No active users</p>
        )}
      </div>
    </div>
  );
};

export default UserList;
