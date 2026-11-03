---- MODULE MermaidOwnership ----
EXTENDS Naturals, FiniteSets, Sequences
VARIABLES active, quarantine, started, expired, linkBusy
vars == <<active, quarantine, started, expired, linkBusy>>
Init == /\ active = {} /\ quarantine = 0 /\ started = 0 /\ expired = {} /\ linkBusy = FALSE
Start == /\ started < 2 /\ ~linkBusy /\ quarantine = 0
         /\ active' = active \cup {started+1} /\ started' = started+1 /\ linkBusy' = TRUE
         /\ UNCHANGED <<quarantine,expired>>
Timeout == /\ linkBusy /\ active # {} /\ quarantine = 0
           /\ \E i \in active : /\ quarantine' = i /\ expired' = expired \cup {i}
           /\ linkBusy' = FALSE /\ UNCHANGED <<active,started>>
Settle(i) == /\ i \in active /\ active' = active \ {i} /\ linkBusy' = FALSE
             /\ quarantine' = IF quarantine = i THEN 0 ELSE quarantine
             /\ UNCHANGED <<started,expired>>
Next == Start \/ Timeout \/ (\E i \in {1,2}: Settle(i))
ExclusiveConfig == Cardinality(active) <= 1
TimeoutKeepsOwner == \A i \in (active \cap expired): quarantine = i
====
