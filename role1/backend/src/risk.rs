use crate::api::{Finding, Risk};

pub fn score(findings: &[Finding]) -> Risk {
    let mut points = 0u16;
    for finding in findings {
        points += match finding.severity.as_str() {
            "critical" => 90,
            "high" => 60,
            "medium" => 25,
            _ => 0,
        };
    }
    let score = points.min(100) as u8;
    let severity = if score >= 85 {
        "critical"
    } else if score >= 60 {
        "high"
    } else if score >= 30 {
        "medium"
    } else {
        "low"
    };
    Risk {
        score,
        severity: severity.into(),
        summary: if score == 0 {
            "No deterministic risk rule was triggered.".into()
        } else {
            format!("Risk score {score}/100 from observed permissions or asset effects.")
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn f(title: &str) -> Finding {
        Finding {
            severity: "high".into(),
            title: title.into(),
            explanation: String::new(),
            evidence: json!({}),
        }
    }
    #[test]
    fn caps_and_buckets() {
        let risk = score(&[f("Unlimited ERC-20 approval"), f("Asset transfer")]);
        assert_eq!(risk.score, 100);
        assert_eq!(risk.severity, "critical");
        assert_eq!(score(&[f("Asset transfer")]).severity, "high");
    }
}
