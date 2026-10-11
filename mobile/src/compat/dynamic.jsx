import {lazy, Suspense} from "react";
export default function dynamic(loader, {loading: Loading} = {}) {
    const Component = lazy(async () => { const value = await loader(); return {default: value.default || value}; });
    return function DynamicComponent(props) {
        return <Suspense fallback={Loading ? <Loading /> : null}><Component {...props} /></Suspense>;
    };
}
