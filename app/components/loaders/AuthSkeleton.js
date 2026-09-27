import AuthShell from "../auth/AuthShell";

export default function AuthSkeleton({register = false, mode}) {
    return (
        <AuthShell register={register} mode={mode} loading>
            <span className="sr-only" role="status">{mode ? "Loading password recovery…" : register ? "Loading registration…" : "Loading login…"}</span>
            <div className="auth-form" aria-hidden="true">
                {Array.from({length: mode === "forgot" ? 1 : register ? 4 : 2}, (_, index) => (
                    <div className="auth-field" key={index}>
                        <span className="ui-skeleton auth-skeleton-label" />
                        <span className="ui-skeleton auth-skeleton-input" />
                    </div>
                ))}
                {!register && !mode && <span className="ui-skeleton auth-skeleton-label" />}
                <div className="auth-submit-area"><div className="auth-button-arena"><span className="ui-skeleton auth-skeleton-button" /></div><span className="ui-skeleton auth-skeleton-hint" /></div>
            </div>
        </AuthShell>
    );
}
