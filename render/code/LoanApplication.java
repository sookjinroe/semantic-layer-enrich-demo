package com.demo.loan.domain;

import com.demo.loan.code.TaxExemption;
import com.demo.loan.code.ProductCode;
import com.demo.loan.code.BancassuranceConsent;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "LOAN_APPL_HIST")
public class LoanApplication {

    @Id
    @Column(name = "LOAN_APPL_NO")
    private String loanApplicationNo;

    @Column(name = "CUST_NO")
    private String customerNo;

    @Column(name = "LOAN_APPL_DT")
    private LocalDate applicationDate;

    @Column(name = "LOAN_AMT")
    private BigDecimal loanAmount;

    @Column(name = "LOAN_TERM_MNTH")
    private Short loanTermMonths;

    @Column(name = "INT_RATE")
    private BigDecimal interestRate;

    @Column(name = "TAX_EXMP_FLG")
    @Enumerated(EnumType.STRING)
    private TaxExemption taxExemption;

    @Column(name = "PRDT_CD")
    @Enumerated(EnumType.STRING)
    private ProductCode productCode;

    @Column(name = "BNS_CD")
    @Enumerated(EnumType.STRING)
    private BancassuranceConsent bancassuranceConsent;

    @Column(name = "RPYMT_MTHD_CD")
    private String repaymentMethodCode;

    @Column(name = "CRDT_GRD_CD")
    private String creditGradeCode;

    @Column(name = "LOAN_STAT_CD")
    private String loanStatusCode;

    // getters / setters 생략
}
