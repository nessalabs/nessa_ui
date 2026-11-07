---- MODULE OverlayCoverage ----
EXTENDS Naturals, FiniteSets, Sequences
VARIABLES hostInert, opened, held, inert
vars == <<hostInert,opened,held,inert>>
Init == /\ hostInert \in BOOLEAN /\ opened = {} /\ held = {} /\ inert = hostInert
Open(i) == /\ i \notin opened /\ opened' = opened \cup {i}
           /\ held' = IF hostInert THEN held ELSE held \cup {i}
           /\ inert' = TRUE /\ UNCHANGED hostInert
Close(i) == /\ i \in opened /\ opened' = opened \ {i}
            /\ held' = held \ {i}
            /\ inert' = IF i \in held THEN (Cardinality(held) > 1) ELSE inert
            /\ UNCHANGED hostInert
Next == (\E i \in {1,2}: Open(i)) \/ (\E i \in {1,2}: Close(i))
RemainingCoverStaysInert == held # {} => inert
HostInertSurvives == hostInert => inert
====
