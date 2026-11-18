"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import {useNetworkCompaniesState} from './network';
import {useOutreachState} from './outreach';

const Activate = createContext(null);
/** @type {import("react").Context<ReturnType<typeof useOutreachState> | null>} */
const Outreach = createContext(null);
/** @type {import("react").Context<ReturnType<typeof useNetworkCompaniesState> | null>} */
const Companies = createContext(null);

export function NetworkProvider({children}) {
 const [started,start] = useState(false);
 const outreach = useOutreachState(started);
 const companies = useNetworkCompaniesState(started);
 return <Activate.Provider value={start}><Outreach.Provider value={outreach}><Companies.Provider value={companies}>{children}</Companies.Provider></Outreach.Provider></Activate.Provider>;
}

export function useOutreach() {
 const start = useContext(Activate);
 useEffect(() => { start(true); }, [start]);
 const value = useContext(Outreach);
 if (!value) throw Error('Network provider is missing.');
 return value;
}

export function useNetworkCompanies() {
 const start = useContext(Activate);
 useEffect(() => { start(true); }, [start]);
 const value = useContext(Companies);
 if (!value) throw Error('Network provider is missing.');
 return value;
}
