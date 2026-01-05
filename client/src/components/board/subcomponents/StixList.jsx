import React from 'react';

const StixList = ({ stix }) => {
    if (!Array.isArray(stix) || stix.length === 0) {
        return <p>No stix have been added to this board yet.</p>;
    }

    const sortedStix = [...stix].sort((a, b) => {
        const aNum = (typeof a?.stickNumber === 'number' && !isNaN(a.stickNumber)) ? a.stickNumber : -Infinity;
        const bNum = (typeof b?.stickNumber === 'number' && !isNaN(b.stickNumber)) ? b.stickNumber : -Infinity;
        return aNum - bNum;
    });

    return (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sortedStix.map((s) => {
                const created = s.createdAt ? new Date(s.createdAt) : null;
                return (
                    <li key={s._id || s.id} style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <strong>
                                {s.stickNumber != null ? `#${s.stickNumber} ` : ''}
                                {s.stickMed ? `${s.stickMed}` : 'Stick'}
                                {s.stickDose != null ? ` — ${s.stickDose}` : ''}
                            </strong>
                            <span style={{ color: '#6b7280', fontSize: 12 }}>
                                {created ? created.toLocaleString() : ''}
                            </span>
                        </div>
                        <div style={{ color: '#374151', marginTop: 4 }}>
                            {(s.stickLocation || s.stickLocMod) && (
                                <span>
                                    Location: {s.stickLocMod ? `${s.stickLocMod} ` : ''}
                                    {s.stickLocation || ''}
                                </span>
                            )}
                        </div>
                        {s.description && (
                            <div style={{ marginTop: 8, fontSize: 14 }}>{s.description}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

export default StixList;
