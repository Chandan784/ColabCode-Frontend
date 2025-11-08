const UserCursor = ({ name, color, position }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        color: color,
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      {name}
      <div
        style={{
          width: "2px",
          height: "20px",
          backgroundColor: color,
        }}
      />
    </div>
  );
};
