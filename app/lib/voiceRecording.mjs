export function microphoneErrorMessage(error) {
    switch (error?.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return "Microphone access is blocked. Allow microphone access for Lista in your device settings, then try again.";
        case "NotFoundError":
        case "DevicesNotFoundError":
            return "No microphone was found. Connect a microphone and try again.";
        case "NotReadableError":
        case "TrackStartError":
            return "The microphone is unavailable. Close other apps using it, check your device’s microphone privacy switch, and try again.";
        default:
            return "Recording could not start. Check microphone access in your device settings and try again.";
    }
}
