import React from "react";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

function Settings() {
    return (
        <UserDashboardLayout>
            <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Preferences
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        Settings
                    </h1>
                </div>

                <div className="space-y-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-cyprus">Notifications</h2>
                                <p className="text-sm text-text-grey">Receive updates about orders and promotions.</p>
                            </div>
                            <button type="button" className="rounded-full bg-ocean-green px-4 py-2 text-xs font-bold text-white">
                                Enabled
                            </button>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-cyprus">Security</h2>
                                <p className="text-sm text-text-grey">Manage login and privacy preferences.</p>
                            </div>
                            <button type="button" className="rounded-full bg-gray-100 px-4 py-2 text-xs font-bold text-cyprus">
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </UserDashboardLayout>
    );
}

export default Settings;
