---- MODULE ApprovalExit ----
EXTENDS Naturals, FiniteSets, Sequences
VARIABLES epoch, active, callbacks, reported, reports, cancelled
vars == <<epoch,active,callbacks,reported,reports,cancelled>>
Init == /\ epoch = 0 /\ active = 0 /\ callbacks = {} /\ reported = {}
        /\ reports = <<>> /\ cancelled = {}
Resolve == /\ active = 0 /\ epoch < 2 /\ epoch' = epoch+1 /\ active' = epoch+1
           /\ callbacks' = callbacks \cup {<<epoch+1,"timer">>,<<epoch+1,"animation">>}
           /\ UNCHANGED <<reported,reports,cancelled>>
Clear == /\ active # 0 /\ cancelled' = cancelled \cup {active} /\ active' = 0
         /\ UNCHANGED <<epoch,callbacks,reported,reports>>
Finish(cb) == /\ cb \in callbacks /\ callbacks' = callbacks \ {cb}
              /\ LET valid == cb[1] \notin cancelled /\ cb[1] \notin reported IN
                   /\ reports' = IF valid THEN Append(reports,[period |-> cb[1],current |-> active]) ELSE reports
                   /\ reported' = IF valid THEN reported \cup {cb[1]} ELSE reported
              /\ UNCHANGED <<epoch,active,cancelled>>
Next == Resolve \/ Clear \/ (\E cb \in callbacks: Finish(cb))
OneReportPerPeriod == Len(reports) = Cardinality({reports[i].period : i \in 1..Len(reports)})
NoStaleReport == \A i \in 1..Len(reports): reports[i].period = reports[i].current
====
