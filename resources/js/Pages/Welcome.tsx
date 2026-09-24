export default function Welcome() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
            <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div>

                <div className="space-y-2">
                    <h1 className="text-4xl font-bold text-white tracking-tight">
                        ITASK
                    </h1>
                    <p className="text-lg text-slate-400 max-w-md">
                        Web-Based Task Management System for Faculty Workflow Coordination
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                    {['Laravel', 'React', 'TypeScript', 'Inertia.js', 'Tailwind CSS', 'PostgreSQL'].map((tech) => (
                        <span
                            key={tech}
                            className="px-3 py-1 text-xs font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-full"
                        >
                            {tech}
                        </span>
                    ))}
                </div>

                <p className="text-sm text-slate-500 pt-4">
                    ✅ Stack is working — ready for development
                </p>
            </div>
        </div>
    );
}
