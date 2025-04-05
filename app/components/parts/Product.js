export default function Product({ product }) {
    return (
        <div className="flex min-w-[300px] text-center max-w-[300px] mx-auto items-center justify-between gap-12 px-2 py-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">{product}</h3>
            </div>
        </div>
    )
}