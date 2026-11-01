import React from "react";
import UserDashboardLayout from "../../layouts/UserDashboardLayout";

function PaymentHistory() {
    const payments = [
        {
            id: "PAY-1024",
            date: "Oct 05, 2026",
            method: "Card ending 4242",
            amount: "$49.99",
            status: "Paid",
        },
        {
            id: "PAY-1023",
            date: "Sep 28, 2026",
            method: "UPI",
            amount: "$59.99",
            status: "Paid",
        },
    ];

    return (
        <UserDashboardLayout>
            <div className="min-h-full bg-gray-50 p-4 sm:p-6 lg:p-8">
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[2px] text-ocean-green">
                        Account Summary
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-cyprus sm:text-3xl">
                        Payment History
                    </h1>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="grid grid-cols-5 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-grey">
                        <span>Invoice</span>
                        <span>Date</span>
                        <span>Method</span>
                        <span>Amount</span>
                        <span>Status</span>
                    </div>

                    {payments.map((payment) => (
                        <div
                            key={payment.id}
                            className="grid grid-cols-5 items-center gap-3 border-t border-gray-200 px-4 py-4 text-sm text-cyprus"
                        >
                            <span className="font-semibold">{payment.id}</span>
                            <span>{payment.date}</span>
                            <span>{payment.method}</span>
                            <span className="font-bold">{payment.amount}</span>
                            <span className="inline-flex w-fit rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                                {payment.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </UserDashboardLayout>
    );
}

export default PaymentHistory;
