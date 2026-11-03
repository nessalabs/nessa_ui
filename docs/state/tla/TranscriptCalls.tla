---- MODULE TranscriptCalls ----
EXTENDS Naturals, FiniteSets, Sequences
VARIABLES open, abandoned, completed, promptDone, observations
vars == <<open,abandoned,completed,promptDone,observations>>
Path(c) == IF c = "mainCall" THEN "main" ELSE "child"
Calls == {"mainCall","childCall"}
Init == /\ open = Calls /\ abandoned = {} /\ completed = {}
        /\ promptDone = {} /\ observations = <<>>
Prompt(p) == /\ p \notin promptDone /\ promptDone' = promptDone \cup {p}
             /\ LET changed == {c \in open : Path(c) = p} IN
                  /\ abandoned' = abandoned \cup changed /\ open' = open \ changed
                  /\ observations' = Append(observations,[scope |-> p,changed |-> changed])
             /\ UNCHANGED completed
Result(c) == /\ c \notin completed /\ completed' = completed \cup {c}
             /\ open' = open \ {c} /\ abandoned' = abandoned \ {c}
             /\ UNCHANGED <<promptDone,observations>>
Next == (\E p \in {"main","child"}: Prompt(p)) \/ (\E c \in Calls: Result(c))
PromptOnlyOwnPath == \A i \in 1..Len(observations): \A c \in observations[i].changed: Path(c) = observations[i].scope
ResultClearsAbandoned == completed \cap abandoned = {}
====
