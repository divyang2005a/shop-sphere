import React, { useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import AdminNavbar from "../components/AdminNavbar";

function AdminDashboardLayout({ children }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="h-dvh overflow-hidden bg-aqua-spring">
            <div className="flex h-full">
                <AdminSidebar
                    mobileOpen={mobileOpen}
                    setMobileOpen={setMobileOpen}
                />

                <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
                    <AdminNavbar
                        onMenuClick={() => setMobileOpen(true)}
                    />

                    <main className="admin-main-scroll min-h-0 flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}

export default AdminDashboardLayout;