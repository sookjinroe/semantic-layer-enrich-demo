package com.demo.loan.code;

public enum TaxExemption {

    Y("면세"),
    N("과세"),
    P("부분면세"),
    X("해당없음");

    private final String label;

    TaxExemption(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
