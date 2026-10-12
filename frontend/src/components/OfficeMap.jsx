import "./OfficeMap.css";

function OfficeMap({ users = [], currentUserId, localPosition}) {
  return (
    <section className="office-section">
      <div className="office-heading">
        <div>
          <h2>Virtual Office</h2>
          <p>Everyone in your shared workspace</p>
        </div>

        <span className="people-count">
          {users.length + (currentUserId ? 1 : 0)} people
        </span>
      </div>

      <div className="office-map">
        {currentUserId && (
          <div 
          className="office-avatar self-avatar"
          style={{
            left: `${(localPosition?.x ?? 500) / 2000*100}%`,
            top: `${(localPosition?.y ?? 250) / 1200*100}%`,
          }}>
            <div className="avatar-circle">You</div>
            <span className="avatar-name">You</span>
          </div>
        )}

        {users.map((user, index) => (
          <div
            key={user.id}
            className={`office-avatar remote-avatar ${
                user.isNearby ? "nearby-avatar" : ""
            }`}
            style={{
              left: `${((user.x ?? 100) / 2000) * 100}%`,
              top: `${((user.y ?? 100) / 1200) * 100}%`,
            }}
          >
            <div 
                className="avatar-circle"
                style={{backgroundColor: user.color  || "#6366f1"}}
            >
              {(user.name || "G").charAt(0).toUpperCase()}
            </div>

            <span className="avatar-name">
              {user.name || "Guest"}
            </span>
          </div>
        ))}

        {!currentUserId && (
          <p className="map-empty">Join an office to see your avatar.</p>
        )}
      </div>
    </section>
  );
}

export default OfficeMap;