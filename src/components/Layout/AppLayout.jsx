import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';

export default function AppLayout({ children, pageTitle }) {
    return (
        <div className="flex h-screen overflow-hidden bg-hotel-light">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header pageTitle={pageTitle} />
                <main id="app-main-content" className="flex-1 overflow-y-auto p-6">
                    <div className="flex min-h-full flex-col">
                        <div className="flex-1">
                            {children}
                        </div>
                        <footer className="mt-8 border-t border-hotel-gray-md/20 pt-4 text-center text-sm font-body text-hotel-gray-md">
                            &copy; {new Date().getFullYear()} Sarah Bomfim
                        </footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
