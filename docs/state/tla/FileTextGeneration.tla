---- MODULE FileTextGeneration ----
EXTENDS Naturals, FiniteSets, Sequences
VARIABLES nextId, active, pending, published
vars == <<nextId,active,pending,published>>
Init == /\ nextId = 0 /\ active = 0 /\ pending = {} /\ published = <<>>
Select == /\ nextId < 2 /\ nextId' = nextId+1 /\ active' = nextId+1
          /\ pending' = pending \cup {nextId+1} /\ UNCHANGED published
Cleanup == /\ active # 0 /\ active' = 0 /\ UNCHANGED <<nextId,pending,published>>
Complete(i) == /\ i \in pending /\ pending' = pending \ {i}
               /\ published' = IF i = active THEN Append(published,[request |-> i,owner |-> active]) ELSE published
               /\ UNCHANGED <<nextId,active>>
Next == Select \/ Cleanup \/ (\E i \in {1,2}: Complete(i))
OnlyCurrentPublishes == \A j \in 1..Len(published): published[j].request = published[j].owner
====
