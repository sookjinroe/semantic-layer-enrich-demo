package com.demo.loan.code;

public enum BancassuranceConsent {

    Y("방카슈랑스 권유 동의"),
    N("권유 비동의"),
    X("권유 대상 아님");

    private final String label;

    BancassuranceConsent(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
