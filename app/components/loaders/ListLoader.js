import "../../css/loaders/list.css";

export default function ListLoader({name}) {
    return (
        <div className="list-creation-loader" role="status" aria-live="polite">
            <p className="list-creation-label">CREATING YOUR LIST</p>
            <div className="list-creation-preview" aria-hidden="true">
                <div className="list-creation-preview-top">
                    <strong>{name?.trim() || "New shopping list"}</strong>
                    <span className="list-creation-dots"><i /><i /><i /></span>
                </div>
                <div className="list-creation-track"><span /></div>
            </div>
            <p className="list-creation-hint">Getting your list ready…</p>
        </div>
    );
}
