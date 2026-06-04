package com.demo.loan.code;

public enum ProductCode {

    L01("직장인 신용대출"),
    M30("주택담보대출 30년 고정"),
    K7("청년 전월세보증금 대출"),
    P10("정책서민금융 대출");

    private final String label;

    ProductCode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
