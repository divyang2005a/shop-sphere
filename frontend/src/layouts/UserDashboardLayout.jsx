import React, { useState } from "react";

import UserDashboardSidebar from "../components/UserDashboardSidebar";
import UserDashboardNavbar from "../components/UserDashboardNavbar";

function UserDashboardLayout({ children }) {
const [mobileOpen, setMobileOpen] = useState(false);

return (
    <div className="h-dvh overflow-hidden bg-gray-50">
        <div className="flex h-full">
            {/* Sidebar */}
            <UserDashboardSidebar
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
            />

            {/* Main Dashboard */}
            <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
                {/* Navbar */}
                <UserDashboardNavbar
                    onMenuClick={() => setMobileOpen(true)}
                />

                {/* Page Content */}
                <main className="min-h-0 flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    </div>
);

}

export default UserDashboardLayout;